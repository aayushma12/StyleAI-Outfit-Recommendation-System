'use strict';

// ── Deterministic outfit candidate generation ───────────────────────────────
// Assembles real, fully-formed outfit combinations from the wardrobe (plus
// generic suggestions where nothing usable exists) — zero LLM calls. This is
// what the scoring/ranking engine (later phase) evaluates instead of asking
// an LLM to invent an outfit from scratch.

const rules = require('./fashionRulesEngine');

const TOP_POOL_CAP    = 8;  // bound combinatorics: 8 tops × 8 bottoms = 64 base combos
const MAX_BASE_COMBOS = 90;
const MAX_ACCESSORIES = 3;

// ── Slot partitioning ────────────────────────────────────────────────────────
// Prefers structured `subcategory` (AI-extracted or user-entered) when present;
// falls back to category + name-keyword heuristics for legacy items — the
// permanent compatibility path, never removed.

const TRADITIONAL_DRESS_KW = /sari|saree|lehenga|gown|mekhli|jumpsuit|frock/;
const TRADITIONAL_BOTTOM_KW = /churidar|salwar|dhoti|skirt|pant|trouser/;
const TRADITIONAL_OUTER_KW = /shawl|dhaka jacket|coat|cardigan|waistcoat|vest/;
const OUTERWEAR_KW = /jacket|blazer|coat|cardigan|shrug|waistcoat|overcoat|windbreaker/;

const ACCESSORY_KW = {
  jewelry:        /earring|necklace|bangle|bracelet|ring|jewel|pote|tika|jhumka/,
  bag:            /bag|purse|clutch|tote|sling|backpack|potli/,
  belt:           /belt/,
  watch:          /watch/,
  scarf:          /scarf|dupatta|stole/,
  sunglasses:     /sunglass|shades/,
  hair_accessory: /hair|clip|barrette|scrunchie|headband/,
};

function resolveSlot(item) {
  const cat  = item.category;
  const text = `${(item.subcategory || '').toLowerCase()} ${(item.name || '').toLowerCase()}`;

  // Explicit, category-agnostic "this is already a complete outfit" flag —
  // kurta sets, co-ord sets, or anything else a user/AI has marked as never
  // needing a separate bottom. Unlike layeringLevel:'one_piece' below (kept
  // scoped to category:'traditional' to avoid a misfire overriding an
  // explicit category), this is safe to trust for any category: it's a
  // reviewable, user-correctable field, not an inferred one.
  if (item.isCompleteOutfit === true) return 'dress';

  if (cat === 'tops') {
    // A blazer/jacket/coat/cardigan uploaded under the folded-in 'tops'
    // category still needs to fill the outerwear slot for weather layering —
    // prefer the structured layeringLevel signal, fall back to a keyword match.
    if (item.layeringLevel === 'outer') return 'outerwear';
    if (OUTERWEAR_KW.test(text)) return 'outerwear';
    return 'top';
  }
  if (cat === 'bottoms')  return 'bottom';
  if (cat === 'dresses')  return 'dress';
  if (cat === 'footwear') return 'footwear';

  // Defensive fallback for any pre-migration document that still has a
  // retired category value — harmless once the migration script has run,
  // never reachable for new writes (the schema enum rejects them).
  if (cat === 'jackets') return 'outerwear';
  if (cat === 'traditional') {
    if (item.layeringLevel === 'one_piece') return 'dress';
    if (TRADITIONAL_DRESS_KW.test(text))  return 'dress';
    if (TRADITIONAL_BOTTOM_KW.test(text)) return 'bottom';
    if (TRADITIONAL_OUTER_KW.test(text))  return 'outerwear';
    return 'top'; // kurta/kurti/blouse/choli — most common traditional top-slot garments
  }

  if (cat === 'accessories') {
    for (const [slot, kw] of Object.entries(ACCESSORY_KW)) {
      if (kw.test(text)) return slot;
    }
    return 'jewelry'; // default accessory bucket when nothing matches
  }

  return null;
}

function partitionIntoSlots(items) {
  const pools = { top: [], bottom: [], dress: [], outerwear: [], footwear: [],
    jewelry: [], bag: [], belt: [], watch: [], scarf: [], sunglasses: [], hair_accessory: [] };
  for (const item of items) {
    const slot = resolveSlot(item);
    if (slot) pools[slot].push(item);
  }
  return pools;
}

// ── Small local color helpers (mirrors scoringService's private extractColors) ─

function colorsOf(item) {
  if (!item) return [];
  if (Array.isArray(item.colorHex) && item.colorHex.length) return item.colorHex;
  if (!item.color) return [];
  return item.color.split(',').map(c => c.trim()).filter(Boolean);
}

function bestColorMatch(candidates, baseColors) {
  if (!candidates.length) return null;
  let best = candidates[0], bestScore = -1;
  for (const c of candidates) {
    const score = rules.colorHarmonyScore([...baseColors, ...colorsOf(c)]);
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

// Maps the wizard's 1-5 "how dressed up do you want to be" comfort scale onto
// fashionRulesEngine's existing 0-4 formality scale (1→0 most relaxed ... 5→4
// most polished) — reused as a soft pre-score bias, not a hard filter, so it
// nudges which owned items get picked without ever excluding anything.
function comfortFormalityTarget(comfortLevel) {
  return comfortLevel - 1;
}

function cheapPreScore(item, occasion, preferredColors = [], comfortLevel = null) {
  let score = rules.occasionScore(item.occasion, occasion);
  if (preferredColors.length) {
    const itemColors = colorsOf(item).map(c => c.toLowerCase());
    const matches = preferredColors.some(pref => itemColors.some(c => c.includes(pref) || pref.includes(c)));
    if (matches) score += 0.15;
  }
  if (Number.isInteger(comfortLevel) && Number.isInteger(item.formalityLevel)) {
    const dist = Math.abs(item.formalityLevel - comfortFormalityTarget(comfortLevel));
    score += Math.max(0, 0.12 - dist * 0.04);
  }
  return score;
}

// Footwear gets its own pre-score on top of the generic one: a wizard
// free-text preference (e.g. "sneakers", "heels") boosts owned items whose
// name/subcategory actually mentions it, ahead of anything else equally
// weather/occasion-appropriate.
function footwearPreScore(item, occasion, footwearPreference, comfortLevel = null) {
  let score = cheapPreScore(item, occasion, [], comfortLevel);
  if (footwearPreference) {
    const text = `${(item.subcategory || '').toLowerCase()} ${(item.name || '').toLowerCase()}`;
    if (text.includes(footwearPreference.toLowerCase().trim())) score += 0.2;
  }
  return score;
}

// ── Slot object helpers (matches Recommendation.outfitSlotSchema shape) ────

function toSlot(item) {
  if (!item) return { item: null, name: '', suggestion: '', reason: '', suggestedItem: null };
  return { item: item._id, name: item.name, suggestion: '', reason: '', suggestedItem: null };
}

function suggestionSlot(text) {
  return { item: null, name: '', suggestion: text, reason: '', suggestedItem: null };
}

function emptySlot() {
  return { item: null, name: '', suggestion: '', reason: '', suggestedItem: null };
}

// ── Catalog-based suggestions ("Suggested Addition" items) ─────────────────
// A real, purchasable product from the (admin-curated) Outfit catalog, used
// to fill a gap the wardrobe doesn't cover — distinct from the plain-text
// generic fallback above. Only ever attached on a real, occasion/season-
// appropriate match; a candidate falls back to generic text (never a weak
// catalog match) when nothing suitable is found.

function catalogColorsOf(item) {
  return Array.isArray(item?.colors) ? item.colors : [];
}

function catalogOccasionOk(item, occasion) {
  if (!Array.isArray(item.occasion) || item.occasion.length === 0) return true;
  const target = (occasion || '').toLowerCase().trim();
  return item.occasion.some(o => (o || '').toLowerCase().trim() === target);
}

function catalogSeasonOk(item, season) {
  if (!Array.isArray(item.season) || item.season.length === 0 || !season) return true;
  const target = season.toLowerCase().trim();
  return item.season.some(s => { const n = (s || '').toLowerCase().trim(); return n === 'all' || n === target; });
}

function bestCatalogMatch(pool, targetCategory, baseColors, occasion, season, styleHint) {
  if (!pool || !pool.length) return null;
  const categories = styleHint === 'traditional' ? [targetCategory, 'traditional'] : [targetCategory];
  const candidates = pool.filter(it =>
    categories.includes(it.category) && catalogOccasionOk(it, occasion) && catalogSeasonOk(it, season)
  );
  if (!candidates.length) return null;

  let best = candidates[0], bestScore = -1;
  for (const c of candidates) {
    const score = rules.colorHarmonyScore([...baseColors, ...catalogColorsOf(c)]);
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

function catalogAccessoryPool(pool, slotName) {
  const kw = ACCESSORY_KW[slotName];
  if (!kw || !pool) return [];
  return pool.filter(it => it.category === 'accessories' &&
    kw.test(`${(it.tags || []).join(' ')} ${it.name || ''}`.toLowerCase()));
}

function catalogSuggestionSlot(catalogItem) {
  return { item: null, name: catalogItem.name, suggestion: '', reason: '', suggestedItem: catalogItem._id };
}

// ── Full candidate assembly ──────────────────────────────────────────────────

function buildFullCandidate(base, filtered, layering, occasion, styleHint, maxAccessories = MAX_ACCESSORIES, season = null, catalogPool = [], wizardPrefs = {}) {
  const { footwearPreference = '', preferredAccessoryTypes = [], comfortLevel = null } = wizardPrefs;
  const slots = {
    top: toSlot(base.top), bottom: toSlot(base.bottom), dress: toSlot(base.dress),
    outerwear: emptySlot(), footwear: emptySlot(),
    accessory: emptySlot(), jewelry: emptySlot(), bag: emptySlot(), belt: emptySlot(),
    watch: emptySlot(), scarf: emptySlot(), sunglasses: emptySlot(), hair_accessory: emptySlot(),
  };
  const needsSuggestion = [];
  const baseColors = [base.top, base.bottom, base.dress].filter(Boolean).flatMap(colorsOf);

  // Outerwear — only attach/require based on weather tier
  if (layering.requireOuterwear || layering.recommendOuterwear) {
    const best = bestColorMatch(filtered.outerwear, baseColors);
    if (best) {
      slots.outerwear = toSlot(best);
    } else {
      const catalogMatch = bestCatalogMatch(catalogPool, 'outerwear', baseColors, occasion, season, styleHint);
      slots.outerwear = catalogMatch
        ? catalogSuggestionSlot(catalogMatch)
        : suggestionSlot(rules.getGenericSuggestion('outerwear', layering.tier, occasion, styleHint));
      needsSuggestion.push('outerwear');
    }
  }

  // Footwear — always fill
  const bestFootwear = filtered.footwear.length
    ? [...filtered.footwear].sort((a, b) => footwearPreScore(b, occasion, footwearPreference, comfortLevel) - footwearPreScore(a, occasion, footwearPreference, comfortLevel))[0]
    : null;
  if (bestFootwear) {
    slots.footwear = toSlot(bestFootwear);
  } else {
    const catalogMatch = bestCatalogMatch(catalogPool, 'footwear', baseColors, occasion, season, styleHint);
    slots.footwear = catalogMatch
      ? catalogSuggestionSlot(catalogMatch)
      : suggestionSlot(rules.getGenericSuggestion('footwear', layering.tier, occasion, styleHint));
    needsSuggestion.push('footwear');
  }

  // Accessories — greedily attach up to maxAccessories, maximizing incremental color harmony.
  // Purely optional: nothing is force-filled with generic suggestion text just to avoid
  // an outfit "looking bare" — an owned-accessory-free outfit legitimately has none.
  // A wizard "must include" preference just reorders which slots get tried
  // first — it never expands maxAccessories or forces a slot with no match.
  const DEFAULT_ACCESSORY_ORDER = ['jewelry', 'bag', 'watch', 'scarf', 'sunglasses', 'hair_accessory', 'belt'];
  const accessorySlotOrder = preferredAccessoryTypes.length
    ? [...DEFAULT_ACCESSORY_ORDER.filter(s => preferredAccessoryTypes.includes(s)),
       ...DEFAULT_ACCESSORY_ORDER.filter(s => !preferredAccessoryTypes.includes(s))]
    : DEFAULT_ACCESSORY_ORDER;
  let attached = 0;
  for (const slotName of accessorySlotOrder) {
    if (attached >= maxAccessories) break;
    const best = bestColorMatch(filtered[slotName] || [], baseColors);
    if (best) { slots[slotName] = toSlot(best); attached++; }
  }

  // Opportunistic catalog suggestions for the two most visually prominent
  // accessory slots — attached only on a real match, never forced, so this
  // can't reintroduce the "accessories feel padded" problem fixed earlier.
  for (const slotName of ['jewelry', 'bag']) {
    if (slots[slotName].name || slots[slotName].suggestion) continue;
    const catalogMatch = bestCatalogMatch(catalogAccessoryPool(catalogPool, slotName), 'accessories', baseColors, occasion, season, styleHint);
    if (catalogMatch) {
      slots[slotName] = catalogSuggestionSlot(catalogMatch);
      needsSuggestion.push(slotName);
    }
  }

  const sourceItemIds = [base.top, base.bottom, base.dress]
    .filter(Boolean).map(it => String(it._id))
    .concat(Object.values(slots).filter(s => s.item).map(s => String(s.item)));

  return { slots, needsSuggestion, sourceItemIds: [...new Set(sourceItemIds)] };
}

/**
 * Generates deterministic outfit candidates from the wardrobe (plus generic
 * suggestions for empty slots). Zero LLM calls — this is what the ranking
 * engine scores, not something an LLM invents.
 *
 * @param {object} user
 * @param {Array}  wardrobeItems - plain WardrobeItem docs (lean or hydrated)
 * @param {object} context - { occasion, weather, season, allowSuggestions, styleHint, preferredColors, maxAccessories, catalogItems, layeringPreference, footwearPreference, preferredAccessoryTypes, comfortLevel }
 */
exports.generateCandidates = function generateCandidates(user, wardrobeItems, context = {}) {
  const occasion  = context.occasion || 'daily';
  const season    = context.season   || null;
  const weather   = context.weather  || {};
  const layering  = rules.getWeatherLayeringAdvice(weather.temp);
  const allowSuggestions = context.allowSuggestions !== false; // false only for strict wardrobe-only mode
  const styleHint = context.styleHint || (rules.requiresTraditionalConsideration?.(occasion) ? 'traditional' : '');
  const preferredColors = (context.preferredColors || []).map(c => c.toLowerCase().trim()).filter(Boolean);
  const maxAccessories  = context.maxAccessories ?? MAX_ACCESSORIES;
  const catalogPool     = context.catalogItems || [];
  const comfortLevel    = Number.isInteger(context.comfortLevel) ? context.comfortLevel : null;
  const wizardPrefs = {
    footwearPreference: context.footwearPreference || '',
    preferredAccessoryTypes: context.preferredAccessoryTypes || [],
    comfortLevel,
  };

  // A wizard layering preference overrides the weather-derived default —
  // "light" means skip outerwear even if it's cool out, "heavy" means
  // require it even if the weather alone wouldn't call for it. Leaves the
  // underlying weather-tier fabric/suggestion text untouched either way.
  if (context.layeringPreference === 'light') {
    layering.requireOuterwear = false; layering.recommendOuterwear = false; layering.skipOuterwear = true;
  } else if (context.layeringPreference === 'heavy') {
    layering.requireOuterwear = true; layering.recommendOuterwear = true; layering.skipOuterwear = false;
  }

  const pools = partitionIntoSlots(wardrobeItems || []);

  const filtered = {};
  for (const slot of ['top', 'bottom', 'dress', 'outerwear', 'footwear']) {
    filtered[slot] = (pools[slot] || []).filter(it => rules.hardFilterItem(it, occasion, season, slot));
  }
  for (const slot of ['jewelry', 'bag', 'belt', 'watch', 'scarf', 'sunglasses', 'hair_accessory']) {
    filtered[slot] = (pools[slot] || []).filter(it => rules.hardFilterItem(it, occasion, season, slot));
  }

  // Cap top/bottom/dress pools by cheap occasion-fit (+ preferred-color) pre-score to bound combinatorics
  for (const slot of ['top', 'bottom', 'dress']) {
    filtered[slot] = filtered[slot]
      .map(it => ({ it, s: cheapPreScore(it, occasion, preferredColors, comfortLevel) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, TOP_POOL_CAP)
      .map(x => x.it);
  }

  // Build base (top+bottom) / dress-only combos
  const baseCombos = [];

  if (filtered.top.length && filtered.bottom.length) {
    for (const top of filtered.top) {
      for (const bottom of filtered.bottom) {
        baseCombos.push({ top, bottom, dress: null });
      }
    }
  } else if (allowSuggestions && (filtered.top.length || filtered.bottom.length)) {
    const tops    = filtered.top.length    ? filtered.top    : [null];
    const bottoms = filtered.bottom.length ? filtered.bottom : [null];
    for (const top of tops) {
      for (const bottom of bottoms) {
        if (top || bottom) baseCombos.push({ top, bottom, dress: null });
      }
    }
  }

  if (filtered.dress.length) {
    for (const dress of filtered.dress) baseCombos.push({ top: null, bottom: null, dress });
  }

  if (baseCombos.length === 0 && allowSuggestions) {
    // Sparse/empty wardrobe fallback — still produce a fully-suggested outfit.
    baseCombos.push({ top: null, bottom: null, dress: null });
  }

  const cappedCombos = baseCombos.slice(0, MAX_BASE_COMBOS);

  const candidates = cappedCombos.map(base => {
    const full = buildFullCandidate(base, filtered, layering, occasion, styleHint, maxAccessories, season, catalogPool, wizardPrefs);
    // Suggestion-fill whichever of top/bottom is missing on a non-dress candidate
    // (wardrobe had only a bottom, only a top, or neither) — leaving a slot truly
    // blank here would make the candidate look "incomplete" and get hard-rejected
    // by validateOutfitCategories below instead of surfacing as a usable suggestion.
    if (!base.dress) {
      if (!base.top) {
        full.needsSuggestion = [...new Set(['top', ...full.needsSuggestion])];
        const catalogMatch = bestCatalogMatch(catalogPool, 'tops', base.bottom ? colorsOf(base.bottom) : [], occasion, season, styleHint);
        full.slots.top = catalogMatch
          ? catalogSuggestionSlot(catalogMatch)
          : suggestionSlot(`a ${styleHint === 'traditional' ? 'traditional kurta or top' : 'versatile top'} suited for ${occasion}`);
      }
      if (!base.bottom) {
        full.needsSuggestion = [...new Set(['bottom', ...full.needsSuggestion])];
        const catalogMatch = bestCatalogMatch(catalogPool, 'bottoms', base.top ? colorsOf(base.top) : [], occasion, season, styleHint);
        full.slots.bottom = catalogMatch
          ? catalogSuggestionSlot(catalogMatch)
          : suggestionSlot(`well-fitted bottoms suited for ${occasion}`);
      }
    }
    return full;
  });

  // Hard-reject any candidate with an invalid category combination (e.g. a dress
  // alongside a separate top/bottom) — never surfaced, even as a last resort.
  const validCandidates = candidates.filter(full => rules.validateOutfitCategories(full.slots).valid);
  if (validCandidates.length === 0 && candidates.length > 0) {
    console.warn(`[candidateGenerationService] all ${candidates.length} candidates were rejected by validateOutfitCategories for occasion="${occasion}"`);
  }
  return validCandidates;
};

exports.partitionIntoSlots = partitionIntoSlots; // exported for testing/inspection
exports.resolveSlot        = resolveSlot;
exports.bestCatalogMatch   = bestCatalogMatch;
