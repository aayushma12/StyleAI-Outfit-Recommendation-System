'use strict';

const { OCCASIONS } = require('../constants/occasions');

// Approximate hue angles (0–360) for common garment colors
const COLOR_HUE = {
  red: 0, crimson: 0, maroon: 0, burgundy: 330,
  coral: 16, salmon: 15, peach: 25,
  orange: 30, rust: 15, terracotta: 20,
  yellow: 60, gold: 45, mustard: 50, amber: 38,
  lime: 80,
  green: 120, olive: 80, emerald: 145, mint: 155, sage: 130,
  teal: 178, cyan: 190, turquoise: 174, aqua: 180,
  blue: 220, navy: 220, royal: 230, cobalt: 215, denim: 220,
  purple: 270, violet: 280, lavender: 260, plum: 290, lilac: 265,
  pink: 330, rose: 340, blush: 340, fuchsia: 310, magenta: 300,
};

const NEUTRAL_COLORS = new Set([
  'black', 'white', 'grey', 'gray', 'beige', 'cream', 'ivory',
  'tan', 'nude', 'brown', 'camel', 'khaki', 'off-white', 'charcoal',
  'taupe', 'sand', 'ecru', 'champagne',
]);

// Skin-tone color guidance for South Asian complexions
const SKIN_TONE_PALETTE = {
  fair:    { enhance: ['blue', 'purple', 'pink', 'green', 'navy', 'rose'],  mute: ['orange', 'yellow'] },
  light:   { enhance: ['teal', 'coral', 'blue', 'purple', 'pink', 'jade'], mute: ['yellow'] },
  medium:  { enhance: ['coral', 'orange', 'green', 'teal', 'gold', 'red', 'magenta'], mute: [] },
  wheatish:{ enhance: ['mustard', 'olive', 'coral', 'teal', 'rust', 'purple'], mute: [] },
  olive:   { enhance: ['rust', 'coral', 'green', 'purple', 'mustard', 'teal', 'cobalt'], mute: [] },
  tan:     { enhance: ['orange', 'yellow', 'coral', 'red', 'gold', 'bright green', 'cobalt'], mute: ['nude'] },
  dark:    { enhance: ['bright', 'yellow', 'orange', 'red', 'royal blue', 'white', 'fuchsia'], mute: ['navy', 'dark brown'] },
};

// Which styles naturally pair well together
const STYLE_COMPAT = {
  minimalist:   ['minimalist', 'classic', 'smart_casual', 'casual'],
  streetwear:   ['streetwear', 'athleisure', 'y2k', 'casual', 'edgy'],
  korean:       ['korean', 'minimalist', 'casual', 'romantic', 'preppy'],
  classic:      ['classic', 'minimalist', 'preppy', 'smart_casual'],
  casual:       ['casual', 'streetwear', 'athleisure', 'boho', 'korean', 'minimalist'],
  boho:         ['boho', 'vintage', 'cottagecore', 'casual', 'romantic'],
  formal:       ['formal', 'classic', 'smart_casual'],
  smart_casual: ['smart_casual', 'classic', 'minimalist', 'casual'],
  athleisure:   ['athleisure', 'streetwear', 'casual', 'sporty'],
  vintage:      ['vintage', 'boho', 'cottagecore', 'y2k', 'romantic'],
  preppy:       ['preppy', 'classic', 'smart_casual', 'korean'],
  romantic:     ['romantic', 'boho', 'korean', 'vintage', 'cottagecore'],
  edgy:         ['edgy', 'streetwear', 'grunge', 'y2k'],
  grunge:       ['grunge', 'edgy', 'streetwear', 'vintage'],
  cottagecore:  ['cottagecore', 'boho', 'romantic', 'vintage'],
  y2k:          ['y2k', 'streetwear', 'casual', 'edgy'],
  traditional:  ['traditional'],
  modest_chic:  ['modest_chic', 'classic', 'smart_casual', 'korean', 'minimalist'],
  sporty:       ['sporty', 'athleisure', 'casual'],
};

// Occasion formality levels, compatible styles, and explicit footwear/
// accessory gating — keyed to the canonical 5-group OCCASIONS list
// (backend/constants/occasions.js). allowSneakers/allowHeavyAccessories are
// deliberately explicit per group rather than derived from a formality
// threshold, since "office" and "traditional" are both mid-to-high formality
// but should NOT be treated the same for accessory weight (office wants
// minimal styling; only traditional/wedding wear should get heavy jewellery).
const OCCASION_META = {
  sports:      { formality: 0, styles: ['sporty', 'athleisure'], allowSneakers: true,  allowHeavyAccessories: false },
  daily:       { formality: 1, styles: ['casual', 'minimalist', 'korean', 'streetwear'], allowSneakers: true,  allowHeavyAccessories: false },
  party:       { formality: 2, styles: ['edgy', 'streetwear', 'y2k', 'romantic', 'classic'], allowSneakers: false, allowHeavyAccessories: false },
  office:      { formality: 3, styles: ['smart_casual', 'classic', 'minimalist', 'formal'], allowSneakers: false, allowHeavyAccessories: false },
  traditional: { formality: 4, styles: ['traditional', 'formal', 'classic', 'boho', 'romantic'], allowSneakers: false, allowHeavyAccessories: true },
};

// Weather layering tiers (temperature ranges in °C)
const WEATHER_TIERS = [
  { name: 'freezing', range: [-20, 5],  outerwear: 'essential',    layers: 3, fabrics: 'wool, thermal, fleece, down jacket' },
  { name: 'cold',     range: [5,  14],  outerwear: 'required',     layers: 3, fabrics: 'wool, medium cotton, warm knits, denim' },
  { name: 'cool',     range: [14, 20],  outerwear: 'recommended',  layers: 2, fabrics: 'cotton, light knits, denim, cardigan' },
  { name: 'mild',     range: [20, 26],  outerwear: 'optional',     layers: 1, fabrics: 'light cotton, linen, chiffon' },
  { name: 'warm',     range: [26, 32],  outerwear: 'skip',         layers: 1, fabrics: 'thin cotton, linen, breathable weaves' },
  { name: 'hot',      range: [32, 50],  outerwear: 'skip',         layers: 1, fabrics: 'linen, moisture-wicking, loose cotton' },
];

function normaliseColor(c) {
  return (c || '').toLowerCase().replace(/[^a-z]/g, '');
}

function isNeutral(color) {
  const n = normaliseColor(color);
  for (const neutral of NEUTRAL_COLORS) {
    if (n.includes(neutral.replace('-', ''))) return true;
  }
  return false;
}

function getHue(color) {
  const n = normaliseColor(color);
  for (const [key, hue] of Object.entries(COLOR_HUE)) {
    if (n.includes(key)) return hue;
  }
  return null;
}

function hueDiff(a, b) {
  const diff = Math.abs(a - b) % 360;
  return Math.min(diff, 360 - diff);
}

exports.colorHarmonyScore = function colorHarmonyScore(colors) {
  if (!colors || colors.length === 0) return 0.5;

  const chromatic    = colors.filter(c => !isNeutral(c));
  const neutralCount = colors.length - chromatic.length;

  if (chromatic.length === 0) return 0.85;
  if (chromatic.length === 1) return 0.90;

  const hues = chromatic.map(getHue).filter(h => h !== null);
  if (hues.length < 2) return 0.72;

  let totalScore = 0;
  let pairs = 0;

  for (let i = 0; i < hues.length; i++) {
    for (let j = i + 1; j < hues.length; j++) {
      const diff = hueDiff(hues[i], hues[j]);
      pairs++;
      if (diff >= 165 && diff <= 195) { totalScore += 0.97; continue; }
      if (diff <= 30)                 { totalScore += 0.92; continue; }
      if (diff >= 110 && diff <= 130) { totalScore += 0.88; continue; }
      if (diff >= 135 && diff <= 165) { totalScore += 0.82; continue; }
      if (diff >= 30  && diff <= 80)  { totalScore += 0.65; continue; }
      totalScore += 0.28;
    }
  }

  const base         = pairs > 0 ? totalScore / pairs : 0.7;
  const neutralBonus = Math.min(0.08, neutralCount * 0.04);
  return Math.min(1, base + neutralBonus);
};

exports.colorPreferenceScore = function colorPreferenceScore(outfitColors, liked = [], disliked = []) {
  if (!outfitColors || outfitColors.length === 0) return 0.5;

  const normOutfit   = outfitColors.map(normaliseColor);
  const normLiked    = liked.map(normaliseColor);
  const normDisliked = disliked.map(normaliseColor);

  const likedHits    = normOutfit.filter(c => normLiked.some(l => c.includes(l) || l.includes(c))).length;
  const dislikedHits = normOutfit.filter(c => normDisliked.some(d => c.includes(d) || d.includes(c))).length;

  let score = 0.55;
  if (liked.length > 0)    score += (likedHits    / normOutfit.length) * 0.35;
  if (disliked.length > 0) score -= (dislikedHits / normOutfit.length) * 0.50;

  return Math.max(0.05, Math.min(1, score));
};

exports.skinToneScore = function skinToneScore(outfitColors, skinTone) {
  if (!skinTone || !outfitColors || outfitColors.length === 0) return 0.70;
  const palette = SKIN_TONE_PALETTE[skinTone?.toLowerCase()?.replace(/[\s-]/g, '')] ||
                  SKIN_TONE_PALETTE.medium;

  const norm = outfitColors.map(normaliseColor);
  let score = 0.60;

  palette.enhance.forEach(e => {
    if (norm.some(c => c.includes(normaliseColor(e)))) score += 0.07;
  });
  palette.mute.forEach(m => {
    if (norm.some(c => c.includes(normaliseColor(m)))) score -= 0.08;
  });

  return Math.max(0.10, Math.min(1, score));
};

exports.styleCompatibilityScore = function styleCompatibilityScore(itemStyles, preferredStyles) {
  if (!itemStyles?.length || !preferredStyles?.length) return 0.65;

  let matchCount = 0;
  let total = 0;

  preferredStyles.forEach(pref => {
    const compat = STYLE_COMPAT[pref] || [pref];
    itemStyles.forEach(iStyle => {
      total++;
      if (compat.includes(iStyle)) matchCount++;
    });
  });

  if (total === 0) return 0.65;
  return 0.40 + (matchCount / total) * 0.60;
};

exports.occasionScore = function occasionScore(itemOccasion, targetOccasion) {
  if (!itemOccasion || itemOccasion === '' || itemOccasion === 'any') return 0.75;
  if (!targetOccasion) return 0.70;

  const norm = s => (s || '').toLowerCase().trim().replace(/[\s-]/g, '_');
  const item   = norm(itemOccasion);
  const target = norm(targetOccasion);

  if (item === target) return 1.0;

  const targetMeta = OCCASION_META[target];
  const itemMeta   = OCCASION_META[item];
  if (!targetMeta || !itemMeta) return 0.50;

  const formalityDiff = Math.abs(targetMeta.formality - itemMeta.formality);
  if (formalityDiff === 0) return 0.90;
  if (formalityDiff === 1) return 0.70;
  if (formalityDiff === 2) return 0.45;
  return 0.20;
};

exports.getWeatherTier = function getWeatherTier(temp) {
  if (temp === null || temp === undefined) return WEATHER_TIERS[3];
  for (const tier of WEATHER_TIERS) {
    if (temp >= tier.range[0] && temp < tier.range[1]) return tier;
  }
  return temp >= 32 ? WEATHER_TIERS[5] : WEATHER_TIERS[0];
};

exports.weatherSuitabilityScore = function weatherSuitabilityScore(outfitSlots, weather) {
  if (!weather || weather.temp === null) return 0.70;

  const { name: tier } = exports.getWeatherTier(weather.temp);
  const hasOuterwear = !!(outfitSlots.outerwear?.name || outfitSlots.outerwear?.item);
  const hasDress     = !!(outfitSlots.dress?.name     || outfitSlots.dress?.item);

  let score = 0.70;

  if (tier === 'cold' || tier === 'freezing') {
    if (hasOuterwear) score += 0.25;
    else score -= 0.30;
    if (hasDress) score -= 0.10;
  } else if (tier === 'cool') {
    if (hasOuterwear) score += 0.15;
  } else if (tier === 'warm' || tier === 'hot') {
    if (hasOuterwear) score -= 0.25;
    if (hasDress) score += 0.10;
  }

  if (weather.code >= 51 && weather.code <= 82) {
    score -= 0.05;
  }

  return Math.max(0.10, Math.min(1, score));
};

exports.validateOutfitCategories = function validateOutfitCategories(slots) {
  const hasTop    = !!(slots.top?.name    || slots.top?.item    || slots.top?.suggestion);
  const hasBottom = !!(slots.bottom?.name || slots.bottom?.item || slots.bottom?.suggestion);
  const hasDress  = !!(slots.dress?.name  || slots.dress?.item  || slots.dress?.suggestion);

  if (hasDress && (hasTop || hasBottom)) {
    return { valid: false, issue: 'Dress and separate top/bottom conflict — use one or the other' };
  }
  if (!hasDress && !hasTop) {
    return { valid: false, issue: 'Missing top or dress — outfit incomplete' };
  }
  return { valid: true };
};

exports.getWeatherLayeringAdvice = function getWeatherLayeringAdvice(temp) {
  const tier      = exports.getWeatherTier(temp);
  const outerwear = tier?.outerwear || 'optional';
  return {
    tier:               tier?.name || 'mild',
    fabrics:            tier?.fabrics || 'comfortable fabrics',
    // 'essential' (freezing) and 'required' (cold) both mean outerwear is a firm need;
    // 'recommended' (cool) is a softer nice-to-have — kept as its own flag so callers
    // can still choose to skip it when nothing suitable is available.
    requireOuterwear:   outerwear === 'essential' || outerwear === 'required',
    recommendOuterwear: outerwear === 'recommended',
    skipOuterwear:      outerwear === 'skip',
    suggestedLayers:    tier?.layers || 1,
  };
};

exports.STYLE_COMPAT      = STYLE_COMPAT;
exports.OCCASIONS         = OCCASIONS;
exports.OCCASION_META     = OCCASION_META;
exports.WEATHER_TIERS     = WEATHER_TIERS;
exports.NEUTRAL_COLORS    = NEUTRAL_COLORS;
// Exported so other modules needing raw hue values (e.g. datasetCompatService's
// pairwise-hue-distance features) reuse this exact table rather than
// re-declaring it — see ml-service/polyvore_compat_trainer.py's COLOR_HUE for
// the Python-side port of this same table.
exports.COLOR_HUE         = COLOR_HUE;
exports.SKIN_TONE_PALETTE = SKIN_TONE_PALETTE;

// ── Body-type compatibility ────────────────────────────────────────────────────
const BODY_TYPE_PROFILE = {
  hourglass:         { flatter: ['wrap','fitted','belted','bodycon','high waist','high-waist','pencil','a-line','peplum','tailored'], avoid: ['boxy','sack','shapeless','tent'] },
  pear:              { flatter: ['a-line','wide leg','wide-leg','flared','flare','structured','v-neck','off shoulder','wrap','empire'], avoid: ['skinny','cargo pocket','balloon'] },
  apple:             { flatter: ['empire','wrap','v-neck','straight leg','flowy','a-line','loose','tunic'], avoid: ['cropped','turtleneck','cinched waist'] },
  rectangle:         { flatter: ['peplum','ruffle','belted','layered','flare','wrap','crop','high waist','high-waist'], avoid: ['straight','column','shapeless'] },
  inverted_triangle: { flatter: ['flare','wide leg','wide-leg','a-line','maxi','v-neck','wrap','palazzo','bootcut'], avoid: ['shoulder pad','puff sleeve','structured shoulder'] },
  plus_size:         { flatter: ['wrap','a-line','empire','flowy','v-neck','straight','vertical','stretchy'], avoid: ['super tight','horizontal stripe','tiny crop'] },
  petite:            { flatter: ['crop','cropped','high waist','high-waist','monochrome','fitted','mini','pointed'], avoid: ['maxi','oversized','chunky','voluminous'] },
  tall:              { flatter: ['wide leg','wide-leg','maxi','flare','oversized','layered','midi','palazzo','bootcut'], avoid: [] },
};

// Fabric keyword inference from item name / notes
const FABRIC_KEYWORDS = {
  cotton:    ['cotton', 'tee', 't-shirt', 'basic tee', 'jersey knit'],
  denim:     ['denim', 'jean', 'jeans'],
  silk:      ['silk'],
  linen:     ['linen'],
  wool:      ['wool', 'knit', 'sweater', 'cardigan', 'pullover', 'woolen', 'tweed'],
  leather:   ['leather'],
  polyester: ['polyester', 'synthetic', 'nylon', 'tech wear'],
  velvet:    ['velvet'],
  chiffon:   ['chiffon'],
  georgette: ['georgette'],
  rayon:     ['rayon', 'viscose'],
  satin:     ['satin'],
  jersey:    ['jersey', 'stretch', 'scuba'],
};

exports.bodyTypeScore = function bodyTypeScore(outfitItems, bodyType) {
  if (!bodyType || !outfitItems?.length) return 0.65;
  const key     = bodyType.toLowerCase().replace(/[\s-]/g, '_');
  const profile = BODY_TYPE_PROFILE[key];
  if (!profile) return 0.65;

  const text = outfitItems.map(it => `${it.name} ${it.notes || ''}`).join(' ').toLowerCase();

  const flatCount  = profile.flatter.filter(kw => text.includes(kw)).length;
  const avoidCount = profile.avoid.filter(kw => text.includes(kw)).length;

  let score = 0.55 + (flatCount / Math.max(1, profile.flatter.length)) * 0.38;
  score    -= (avoidCount / Math.max(1, profile.avoid.length)) * 0.25;
  return Math.max(0.10, Math.min(1, score));
};

exports.fabricPreferenceScore = function fabricPreferenceScore(outfitItems, fabricPrefs) {
  if (!fabricPrefs?.length || !outfitItems?.length) return 0.65;

  const text = outfitItems.map(it => `${it.name} ${it.notes || ''}`).join(' ').toLowerCase();

  let matchCount = 0;
  fabricPrefs.forEach(pref => {
    const keywords = FABRIC_KEYWORDS[pref] || [pref];
    if (keywords.some(kw => text.includes(kw))) matchCount++;
  });

  return 0.50 + (matchCount / fabricPrefs.length) * 0.45;
};

exports.BODY_TYPE_PROFILE = BODY_TYPE_PROFILE;
exports.FABRIC_KEYWORDS   = FABRIC_KEYWORDS;

// ── Hard filters (candidate generation, Phase 2) ────────────────────────────
// Rejects only on CERTAIN conflicts. Legacy items that lack the new structured
// fields (formalityLevel/suitableSeasons) always pass — they're soft-scored
// later, never hard-filtered, so nothing already in a user's wardrobe becomes
// unusable just because it predates this metadata.
const SNEAKER_KW = /sneaker|trainer|sport(s)? ?shoe|running shoe|flip.?flop|slipper|crocs?|rubber sandal|canvas shoe/i;
const HEAVY_ACCESSORY_KW = /bridal|ceremonial|kundan|polki|statement|chunky|embellished|oversized|temple jewel(le)?ry|choker set|maang tikka|layered necklace/i;
const LIGHT_ACCESSORY_KW = /simple|minimal|thin|stud|everyday|delicate|small hoop/i;
const ACCESSORY_SLOTS = new Set(['jewelry', 'bag', 'belt', 'watch', 'scarf', 'sunglasses', 'hair_accessory']);

function classifyAccessoryWeight(item) {
  const text = `${item.subcategory || ''} ${(item.styleTags || []).join(' ')} ${item.materialGuess || ''} ${item.name || ''}`.toLowerCase();
  if (HEAVY_ACCESSORY_KW.test(text)) return 'heavy';
  if (LIGHT_ACCESSORY_KW.test(text)) return 'light';
  return 'moderate';
}

exports.hardFilterItem = function hardFilterItem(item, targetOccasion, currentSeason, slot = '') {
  const target = (targetOccasion || '').toLowerCase().trim().replace(/[\s-]/g, '_');
  const meta   = OCCASION_META[target];
  const isAccessorySlot = ACCESSORY_SLOTS.has(slot);

  // Tightened from >2 to >1 now that occasion is a reliable required
  // canonical enum instead of unreliable free text. Scoped to non-accessory
  // slots — accessories rely on the dedicated weight-based rule below
  // instead, since a plain formality-gap check would also reject a light,
  // perfectly appropriate accessory just for being "underdressed" on paper,
  // which isn't the failure mode we're guarding against here.
  if (!isAccessorySlot && meta && Number.isInteger(item.formalityLevel)) {
    if (Math.abs(item.formalityLevel - meta.formality) > 1) return false;
  }

  if (currentSeason && Array.isArray(item.suitableSeasons) && item.suitableSeasons.length > 0) {
    if (!item.suitableSeasons.includes('all') && !item.suitableSeasons.includes(currentSeason)) return false;
  }

  // Footwear: hard-reject sneakers/sport-shoes/flip-flops for any occasion
  // group that doesn't explicitly allow them (party/office/traditional) —
  // e.g. sneakers with a wedding lehenga or gym shoes for the office.
  if (slot === 'footwear' && meta && !meta.allowSneakers) {
    const text = `${item.subcategory || ''} ${item.name || ''} ${item.materialGuess || ''}`.toLowerCase();
    if (SNEAKER_KW.test(text)) return false;
  }

  // Accessories: hard-reject heavy/bridal-weight pieces for any occasion
  // group that doesn't explicitly allow them — heavy jewellery is reserved
  // for traditional/wedding wear, never casual, office, party, or sports.
  // Deliberately one-directional: a light accessory at a traditional
  // occasion is only soft-scored, not hard-rejected.
  if (isAccessorySlot && meta && !meta.allowHeavyAccessories) {
    if (classifyAccessoryWeight(item) === 'heavy') return false;
  }

  return true;
};

exports.classifyAccessoryWeight = classifyAccessoryWeight;

// ── Generic suggestions (candidate generation, Phase 2) ─────────────────────
// Lets the pipeline always produce a complete, sensible outfit with ZERO LLM
// calls when the wardrobe has nothing usable for a slot. The optional LLM
// gap-fill step (later phase) may upgrade this text — it never has to invent
// the outfit structure from scratch.
const GENERIC_OUTERWEAR = {
  freezing: 'a heavy wool coat or padded jacket',
  cold:     'a structured wool blazer or warm jacket',
  cool:     'a light cardigan or denim jacket',
  mild:     'a light cardigan (optional layering piece)',
  warm:     'no outerwear needed — keep it light',
  hot:      'no outerwear needed — prioritise breathable fabrics',
};

const GENERIC_FOOTWEAR = {
  office: 'smart loafers or block heels', traditional: 'elegant heels or embellished juttis',
  party: 'statement heels or stylish flats', sports: 'supportive sneakers',
  daily: 'comfortable everyday sneakers or flats',
};

const GENERIC_TRADITIONAL = {
  jewelry: 'gold-tone jhumka earrings and a pote necklace', bag: 'a potli or embellished clutch',
  footwear: 'traditional juttis', scarf: 'a matching dupatta',
};

const GENERIC_DEFAULT = {
  jewelry: 'delicate gold-tone earrings and a thin chain', bag: 'a structured tote or crossbody bag',
  belt: 'a slim matching belt', watch: 'a minimalist wristwatch',
  scarf: 'a lightweight scarf for a pop of colour', sunglasses: 'classic sunglasses',
  hair_accessory: 'a simple hair clip or scrunchie',
};

exports.getGenericSuggestion = function getGenericSuggestion(slot, weatherTier, occasion, styleHint) {
  const occ = (occasion || '').toLowerCase().trim().replace(/[\s-]/g, '_');
  const traditional = styleHint === 'traditional' || occ === 'traditional';

  if (slot === 'outerwear') return GENERIC_OUTERWEAR[weatherTier] || GENERIC_OUTERWEAR.mild;
  if (slot === 'footwear')  return (traditional && GENERIC_TRADITIONAL.footwear) || GENERIC_FOOTWEAR[occ] || 'comfortable everyday sneakers or flats';
  if (traditional && GENERIC_TRADITIONAL[slot]) return GENERIC_TRADITIONAL[slot];
  return GENERIC_DEFAULT[slot] || 'a suitable accessory piece';
};
