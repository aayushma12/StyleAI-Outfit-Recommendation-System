'use strict';

// ── Persona archetypes for realistic, heterogeneous synthetic training data ──
// The original bootstrap generator (seedSyntheticTrainingBehavior.js) draws
// every sample from ONE global quality distribution broadcast identically to
// all 9 scoring dimensions — there is no user-level structure for a model
// (or a thesis) to point to as "personalization." This module defines a
// small, hand-curated set of distinct young-Kathmandu-woman style archetypes,
// each with its own occasion bias, climate comfort zone, festival affinity,
// and a partial override of the 9 scoring dimensions' relative importance —
// then expands each into several jittered persona instances so the resulting
// dataset has genuine, auditable heterogeneity without being so large it's
// impossible to sanity-check by hand in a thesis appendix.
//
// Field names for `dimensionWeightBias` match Recommendation.js's
// scoreBreakdownSchema exactly: styleMatch, colorHarmony, colorPreference,
// occasionFit, weatherFit, behaviorSignal, bodyTypeMatch, fabricMatch, trendScore.

const SCORE_DIMENSIONS = [
  'styleMatch', 'colorHarmony', 'colorPreference', 'occasionFit', 'weatherFit',
  'behaviorSignal', 'bodyTypeMatch', 'fabricMatch', 'trendScore',
];

// Recommendation-generation occasion vocabulary (matches VALID_OCCASIONS in
// backend/routes/recommendations.js) — deliberately broader than User.js's
// own narrower occasionPreferences enum, since these drive simulated
// recommendation *sessions*, not just the persona's stored profile.
const ALL_OCCASIONS = [
  'daily', 'college', 'home', 'travel', 'gym', 'cafe', 'shopping', 'date',
  'party', 'office', 'formal', 'festival', 'wedding', 'pooja', 'trekking',
];

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
function pickN(arr, n) { return [...arr].sort(() => Math.random() - 0.5).slice(0, n); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function jitter(v, spread) { return v + (Math.random() * 2 - 1) * spread; }

const ARCHETYPES = [
  {
    key: 'korean_minimalist_college', fashionStyles: ['korean', 'minimalist'],
    stylePreferences: ['minimalist', 'casual'], topOccasions: ['college', 'cafe', 'daily', 'shopping'],
    idealTempC: 18, traditionalAffinity: 0.15, lifestyle: 'student', modestyLevel: 'moderate',
    bodyTypes: ['rectangle', 'hourglass'], fabrics: ['cotton', 'denim', 'jersey'],
    colors: ['beige', 'white', 'black', 'sage', 'cream'],
    dimensionWeightBias: { styleMatch: 0.06, colorHarmony: 0.05, trendScore: 0.02, weatherFit: -0.03 },
  },
  {
    key: 'traditional_festival_lover', fashionStyles: ['classic', 'romantic'],
    stylePreferences: ['traditional', 'fusion'], topOccasions: ['festival', 'wedding', 'pooja', 'formal'],
    idealTempC: 20, traditionalAffinity: 0.9, lifestyle: 'mixed', modestyLevel: 'conservative',
    bodyTypes: ['hourglass', 'pear', 'apple'], fabrics: ['silk', 'georgette', 'chiffon'],
    colors: ['red', 'gold', 'maroon', 'green'],
    dimensionWeightBias: { occasionFit: 0.07, colorHarmony: 0.05, bodyTypeMatch: 0.03, trendScore: -0.04 },
  },
  {
    key: 'office_professional_minimalist', fashionStyles: ['smart_casual', 'classic'],
    stylePreferences: ['formal', 'minimalist'], topOccasions: ['office', 'formal', 'daily', 'cafe'],
    idealTempC: 21, traditionalAffinity: 0.25, lifestyle: 'working_professional', modestyLevel: 'moderate',
    bodyTypes: ['rectangle', 'inverted_triangle', 'hourglass'], fabrics: ['cotton', 'wool', 'polyester'],
    colors: ['navy', 'black', 'white', 'gray'],
    dimensionWeightBias: { occasionFit: 0.06, fabricMatch: 0.04, styleMatch: 0.02, trendScore: -0.05 },
  },
  {
    key: 'streetwear_trend_chaser', fashionStyles: ['streetwear', 'y2k', 'edgy'],
    stylePreferences: ['western', 'casual'], topOccasions: ['party', 'college', 'date', 'shopping'],
    idealTempC: 19, traditionalAffinity: 0.1, lifestyle: 'student', modestyLevel: 'open',
    bodyTypes: ['rectangle', 'apple', 'pear'], fabrics: ['denim', 'polyester', 'leather'],
    colors: ['black', 'silver', 'purple', 'neon-green'],
    dimensionWeightBias: { trendScore: 0.08, styleMatch: 0.05, weatherFit: -0.05, fabricMatch: -0.02 },
  },
  {
    key: 'budget_conscious_practical', fashionStyles: ['minimalist', 'classic'],
    stylePreferences: ['casual'], topOccasions: ['daily', 'home', 'college', 'shopping'],
    idealTempC: 20, traditionalAffinity: 0.2, lifestyle: 'student', modestyLevel: 'moderate',
    bodyTypes: ['rectangle', 'apple', 'pear', 'hourglass'], fabrics: ['cotton', 'jersey', 'polyester'],
    colors: ['beige', 'blue', 'gray', 'white'],
    dimensionWeightBias: { fabricMatch: 0.06, weatherFit: 0.05, trendScore: -0.07 },
  },
  {
    key: 'romantic_boho_dreamer', fashionStyles: ['romantic', 'boho', 'cottagecore'],
    stylePreferences: ['bohemian', 'fusion'], topOccasions: ['date', 'cafe', 'party', 'shopping'],
    idealTempC: 22, traditionalAffinity: 0.35, lifestyle: 'mixed', modestyLevel: 'moderate',
    bodyTypes: ['hourglass', 'pear'], fabrics: ['chiffon', 'georgette', 'linen'],
    colors: ['rose', 'cream', 'lavender', 'terracotta'],
    dimensionWeightBias: { colorHarmony: 0.07, styleMatch: 0.04, occasionFit: -0.02 },
  },
  {
    key: 'athleisure_active', fashionStyles: ['athleisure'],
    stylePreferences: ['sporty', 'casual'], topOccasions: ['gym', 'travel', 'daily', 'college'],
    idealTempC: 17, traditionalAffinity: 0.05, lifestyle: 'student', modestyLevel: 'open',
    bodyTypes: ['rectangle', 'inverted_triangle', 'apple'], fabrics: ['jersey', 'polyester', 'cotton'],
    colors: ['black', 'gray', 'blue', 'neon-green'],
    dimensionWeightBias: { weatherFit: 0.07, fabricMatch: 0.06, colorHarmony: -0.05, trendScore: -0.02 },
  },
  {
    key: 'modest_chic_conservative', fashionStyles: ['modest_chic', 'classic'],
    stylePreferences: ['traditional', 'formal'], topOccasions: ['pooja', 'formal', 'wedding', 'office'],
    idealTempC: 21, traditionalAffinity: 0.75, lifestyle: 'mixed', modestyLevel: 'conservative',
    bodyTypes: ['pear', 'apple', 'hourglass'], fabrics: ['cotton', 'silk', 'wool'],
    colors: ['navy', 'maroon', 'olive', 'beige'],
    dimensionWeightBias: { occasionFit: 0.06, bodyTypeMatch: 0.04, trendScore: -0.06 },
  },
  {
    key: 'vintage_grunge_alt', fashionStyles: ['vintage', 'grunge', 'edgy'],
    stylePreferences: ['western', 'casual'], topOccasions: ['cafe', 'party', 'college', 'shopping'],
    idealTempC: 18, traditionalAffinity: 0.1, lifestyle: 'student', modestyLevel: 'open',
    bodyTypes: ['rectangle', 'apple'], fabrics: ['denim', 'leather', 'velvet'],
    colors: ['black', 'maroon', 'olive', 'brown'],
    dimensionWeightBias: { styleMatch: 0.07, trendScore: 0.04, occasionFit: -0.03 },
  },
  {
    key: 'preppy_smart_casual', fashionStyles: ['preppy', 'smart_casual'],
    stylePreferences: ['formal', 'casual'], topOccasions: ['office', 'college', 'cafe', 'shopping'],
    idealTempC: 20, traditionalAffinity: 0.3, lifestyle: 'mixed', modestyLevel: 'moderate',
    bodyTypes: ['hourglass', 'rectangle', 'inverted_triangle'], fabrics: ['cotton', 'wool', 'satin'],
    colors: ['navy', 'white', 'red', 'beige'],
    dimensionWeightBias: { occasionFit: 0.04, colorHarmony: 0.04, styleMatch: 0.02 },
  },
];

// Builds a normalized (sums to 1) 9-dim weight vector: equal base weight
// (1/9 each) plus the archetype's bias plus small per-persona noise, then
// re-normalized and clamped to stay positive.
function buildWeightVector(bias) {
  const base = 1 / SCORE_DIMENSIONS.length;
  const raw = {};
  SCORE_DIMENSIONS.forEach(dim => {
    raw[dim] = Math.max(0.02, base + (bias[dim] || 0) + jitter(0, 0.01));
  });
  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  const weights = {};
  SCORE_DIMENSIONS.forEach(dim => { weights[dim] = raw[dim] / total; });
  return weights;
}

/**
 * Expands each of the 10 hand-curated archetypes into `countPerArchetype`
 * jittered persona instances (default 3 => 30 personas total). Each persona
 * gets a stable, human-readable ID, a fully-specified style profile derived
 * from its archetype, and its own normalized 9-dim weight vector.
 */
function expandArchetypesToPersonas(countPerArchetype = 3) {
  const personas = [];
  ARCHETYPES.forEach(arch => {
    for (let i = 1; i <= countPerArchetype; i++) {
      personas.push({
        personaId: `${arch.key}_${String(i).padStart(2, '0')}`,
        archetype: arch.key,
        fashionStyles: arch.fashionStyles,
        stylePreferences: arch.stylePreferences,
        topOccasions: arch.topOccasions,
        idealTempC: clamp(jitter(arch.idealTempC, 2), 12, 28),
        traditionalAffinity: clamp(jitter(arch.traditionalAffinity, 0.1), 0, 1),
        lifestyle: arch.lifestyle,
        modestyLevel: arch.modestyLevel,
        bodyType: pick(arch.bodyTypes),
        fabricPreferences: pickN(arch.fabrics, Math.min(2, arch.fabrics.length)),
        colorPreferences: pickN(arch.colors, Math.min(3, arch.colors.length)),
        weights: buildWeightVector(arch.dimensionWeightBias),
        meanQuality: clamp(jitter(58, 8), 45, 72),
        stdQuality: clamp(jitter(18, 4), 10, 26),
        midpoint: clamp(jitter(55, 7), 45, 65),
        steepness: clamp(jitter(12, 4), 7, 18),
      });
    }
  });
  return personas;
}

module.exports = {
  SCORE_DIMENSIONS,
  ALL_OCCASIONS,
  ARCHETYPES,
  expandArchetypesToPersonas,
  buildWeightVector,
  randInt, pick, pickN, clamp, jitter,
};
