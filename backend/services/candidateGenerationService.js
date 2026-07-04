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

  if (cat === 'tops')     return 'top';
  if (cat === 'bottoms')  return 'bottom';
  if (cat === 'dresses')  return 'dress';
  if (cat === 'jackets')  return 'outerwear';
  if (cat === 'footwear') return 'footwear';

  if (cat === 'traditional') {
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

function cheapPreScore(item, occasion, preferredColors = []) {
  let score = rules.occasionScore(item.occasion, occasion);
  if (preferredColors.length) {
    const itemColors = colorsOf(item).map(c => c.toLowerCase());
    const matches = preferredColors.some(pref => itemColors.some(c => c.includes(pref) || pref.includes(c)));
    if (matches) score += 0.15;
  }
  return score;
}

// ── Slot object helpers (matches Recommendation.outfitSlotSchema shape) ────

function toSlot(item) {
  if (!item) return { item: null, name: '', suggestion: '', reason: '' };
  return { item: item._id, name: item.name, suggestion: '', reason: '' };
}

function suggestionSlot(text) {
  return { item: null, name: '', suggestion: text, reason: '' };
}

function emptySlot() {
  return { item: null, name: '', suggestion: '', reason: '' };
}

// ── Full candidate assembly ──────────────────────────────────────────────────

function buildFullCandidate(base, filtered, layering, occasion, styleHint, maxAccessories = MAX_ACCESSORIES) {
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
      slots.outerwear = suggestionSlot(rules.getGenericSuggestion('outerwear', layering.tier, occasion, styleHint));
      needsSuggestion.push('outerwear');
    }
  }

  // Footwear — always fill
  const bestFootwear = filtered.footwear.length
    ? [...filtered.footwear].sort((a, b) => cheapPreScore(b, occasion) - cheapPreScore(a, occasion))[0]
    : null;
  if (bestFootwear) {
    slots.footwear = toSlot(bestFootwear);
  } else {
    slots.footwear = suggestionSlot(rules.getGenericSuggestion('footwear', layering.tier, occasion, styleHint));
    needsSuggestion.push('footwear');
  }

  // Accessories — greedily attach up to maxAccessories, maximizing incremental color harmony
  const accessorySlotOrder = ['jewelry', 'bag', 'watch', 'scarf', 'sunglasses', 'hair_accessory', 'belt'];
  let attached = 0;
  for (const slotName of accessorySlotOrder) {
    if (attached >= maxAccessories) break;
    const best = bestColorMatch(filtered[slotName] || [], baseColors);
    if (best) { slots[slotName] = toSlot(best); attached++; }
  }
  // Guarantee at least min(2, maxAccessories) slots are filled (owned or suggested) — a
  // bare outfit with zero accessories reads as incomplete for this thesis's
  // "complete outfit" requirement.
  const minAccessories = Math.min(2, maxAccessories);
  for (const slotName of ['jewelry', 'bag']) {
    if (attached >= minAccessories) break;
    if (!slots[slotName].name && !slots[slotName].suggestion) {
      slots[slotName] = suggestionSlot(rules.getGenericSuggestion(slotName, layering.tier, occasion, styleHint));
      needsSuggestion.push(slotName);
      attached++;
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
 * @param {object} context - { occasion, weather, season, allowSuggestions, styleHint, preferredColors, maxAccessories }
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

  const pools = partitionIntoSlots(wardrobeItems || []);

  const filtered = {};
  for (const slot of ['top', 'bottom', 'dress', 'outerwear', 'footwear']) {
    filtered[slot] = (pools[slot] || []).filter(it => rules.hardFilterItem(it, occasion, season));
  }
  for (const slot of ['jewelry', 'bag', 'belt', 'watch', 'scarf', 'sunglasses', 'hair_accessory']) {
    filtered[slot] = pools[slot] || [];
  }

  // Cap top/bottom/dress pools by cheap occasion-fit (+ preferred-color) pre-score to bound combinatorics
  for (const slot of ['top', 'bottom', 'dress']) {
    filtered[slot] = filtered[slot]
      .map(it => ({ it, s: cheapPreScore(it, occasion, preferredColors) }))
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

  return cappedCombos.map(base => {
    const full = buildFullCandidate(base, filtered, layering, occasion, styleHint, maxAccessories);
    if (!base.top && !base.bottom && !base.dress) {
      full.needsSuggestion = [...new Set(['top', 'bottom', ...full.needsSuggestion])];
      full.slots.top = suggestionSlot(`a ${styleHint === 'traditional' ? 'traditional kurta or top' : 'versatile top'} suited for ${occasion}`);
      full.slots.bottom = suggestionSlot(`well-fitted bottoms suited for ${occasion}`);
    }
    return full;
  });
};

exports.partitionIntoSlots = partitionIntoSlots; // exported for testing/inspection
exports.resolveSlot        = resolveSlot;
