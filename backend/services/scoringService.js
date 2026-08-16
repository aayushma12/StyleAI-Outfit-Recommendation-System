'use strict';

const rules = require('./fashionRulesEngine');
const { CATEGORY_WEIGHTS } = require('../config/scoringWeights');

const RECOMMENDATION_CATEGORIES = [
  {
    key:   'best_match',
    label: 'Best Match',
    emoji: '⭐',
    brief: 'Optimal balance of your style, preferences, occasion, and Kathmandu weather',
    prompt: 'the single best all-round outfit that perfectly balances ALL factors — style profile, color harmony, occasion, Kathmandu weather, and behavioral learning signals',
  },
  {
    key:   'most_stylish',
    label: 'Most Stylish',
    emoji: '✨',
    brief: 'Maximum fashion-forward style and color sophistication',
    prompt: 'the most fashion-forward and visually striking outfit, prioritizing style coherence and color sophistication above all other factors',
  },
  {
    key:   'most_comfortable',
    label: 'Most Comfortable',
    emoji: '😊',
    brief: 'Prioritises comfort, practicality, and wearability',
    prompt: 'the most comfortable and practical outfit — prioritize ease of movement, fabric breathability, and all-day wearability',
  },
  {
    key:   'weather_optimized',
    label: 'Weather Smart',
    emoji: '🌤',
    brief: 'Optimised for Kathmandu\'s current weather conditions',
    prompt: 'the outfit best suited for Kathmandu\'s current weather conditions, prioritizing weather-appropriateness above everything else',
  },
  {
    key:   'wardrobe_champion',
    label: 'From Your Wardrobe',
    emoji: '👗',
    brief: '100% from your own wardrobe — no external suggestions needed',
    prompt: 'a complete outfit using ONLY items that already exist in the wardrobe — no external suggestions allowed. Every single slot must be filled from owned items',
  },
];

exports.RECOMMENDATION_CATEGORIES = RECOMMENDATION_CATEGORIES;
exports.CATEGORY_WEIGHTS = CATEGORY_WEIGHTS;
// Exported so other services (e.g. adaptiveRerankService) reuse the exact
// same style-inference/formality-averaging logic rather than duplicating it.
exports.inferItemStyles = inferItemStyles;
exports.avgFormality = avgFormality;
exports.extractColors = extractColors;

function extractColors(item) {
  if (!item.color) return [];
  return item.color.split(',').map(c => c.trim()).filter(Boolean);
}

function inferItemStyles(item) {
  const text = `${item.name} ${item.category} ${item.color} ${item.occasion || ''}`.toLowerCase();
  const styles = [];

  if (/formal|blazer|suit|trouser|court shoe|heel/i.test(text)) styles.push('formal', 'classic');
  if (/denim|jean|sneaker|hoodie|bomber|cap/i.test(text)) styles.push('casual', 'streetwear');
  if (/floral|maxi|boho|wrap|peasant|crochet/i.test(text)) styles.push('boho', 'romantic');
  if (/sport|track|sweat|gym|legging|activewear/i.test(text)) styles.push('athleisure', 'sporty');
  if (/minimal|basic|plain|simple|white|black|mono/i.test(text)) styles.push('minimalist', 'classic');
  if (/vintage|retro|thrift|70s|80s|90s/i.test(text)) styles.push('vintage');
  if (/dhaka|kurta|sari|salwar|churidar|mekhli|lehenga|traditional/i.test(text)) styles.push('traditional');
  if (/korean|crop|oversized|chunky|tote|aesthetic/i.test(text)) styles.push('korean', 'casual');
  if (/y2k|butterfly|low-rise|cargo|platform|fairy/i.test(text)) styles.push('y2k', 'streetwear');
  if (/linen|cotton|summer|light|breathable/i.test(text)) styles.push('casual', 'minimalist');
  if (/knit|sweater|cardigan|wool|cozy/i.test(text)) styles.push('casual', 'korean', 'minimalist');

  return [...new Set(styles)];
}

function calcStyleMatchScore(outfitItems, userProfile) {
  const userStyles = [
    ...(userProfile.stylePreferences || []),
    ...(userProfile.fashionStyles    || []),
  ];

  if (userStyles.length === 0) return 0.65;

  const itemStyles = outfitItems.flatMap(inferItemStyles);
  return rules.styleCompatibilityScore(itemStyles, userStyles);
}

function calcColorHarmonyScore(outfitItems) {
  const allColors = outfitItems.flatMap(extractColors);
  return rules.colorHarmonyScore(allColors);
}

function calcColorPreferenceScore(outfitItems, userProfile) {
  const allColors = outfitItems.flatMap(extractColors);
  const skinScore = rules.skinToneScore(allColors, userProfile.skinTone);
  const prefScore = rules.colorPreferenceScore(
    allColors,
    userProfile.colorPreferences || [],
    userProfile.dislikedColors   || [],
  );
  return skinScore * 0.4 + prefScore * 0.6;
}

function calcOccasionScore(outfitItems, targetOccasion) {
  if (!targetOccasion) return 0.70;

  const scores = outfitItems.map(it => rules.occasionScore(it.occasion, targetOccasion));
  if (scores.length === 0) return 0.70;

  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function calcWeatherFitScore(outfitSlots, weather) {
  return rules.weatherSuitabilityScore(outfitSlots, weather);
}

function calcBehaviorScore(outfitItems, insights, collaborativeSignal, negativeSignals = {}, targetOccasion = '') {
  let score = 0.50;

  if (insights?.hasHistory) {
    const allColors     = outfitItems.flatMap(extractColors).map(c => c.toLowerCase());
    const allCategories = outfitItems.map(it => it.category?.toLowerCase()).filter(Boolean);

    if (insights.topColors?.length > 0 && allColors.length > 0) {
      const topNorm   = insights.topColors.map(c => c.toLowerCase());
      const colorHits = allColors.filter(c => topNorm.some(t => c.includes(t) || t.includes(c))).length;
      score += (colorHits / allColors.length) * 0.25;
    }

    if (insights.topCategories?.length > 0 && allCategories.length > 0) {
      const topCats = insights.topCategories.map(c => c.toLowerCase());
      const catHits = allCategories.filter(c => topCats.includes(c)).length;
      score += (catHits / allCategories.length) * 0.20;
    }

    if (insights.recommendationStats?.acceptRate > 70) score += 0.05;
    else if (insights.recommendationStats?.acceptRate < 30) score -= 0.05;

    // Trend signals — recently accelerating preferences get a boost
    if (insights.trendingColors?.length > 0 && allColors.length > 0) {
      const trending = insights.trendingColors.map(c => c.toLowerCase());
      const trendHits = allColors.filter(c => trending.some(t => c.includes(t) || t.includes(c))).length;
      if (trendHits > 0) score += 0.05; // small boost for trending colors
    }
  }

  // Negative signal penalty — reduce score if outfit uses avoided colors/categories
  if (negativeSignals?.avoidColors?.length > 0) {
    const allColors = outfitItems.flatMap(extractColors).map(c => c.toLowerCase());
    const avoid     = negativeSignals.avoidColors.map(c => c.toLowerCase());
    const penaltyCount = allColors.filter(c => avoid.some(a => c.includes(a) || a.includes(c))).length;
    if (penaltyCount > 0) score -= penaltyCount * 0.12;
  }
  if (negativeSignals?.avoidStyles?.length > 0) {
    const itemStyles = outfitItems.flatMap(inferItemStyles);
    const avoid      = negativeSignals.avoidStyles.map(s => s.toLowerCase());
    const penaltyCount = itemStyles.filter(s => avoid.includes(s.toLowerCase())).length;
    if (penaltyCount > 0) score -= penaltyCount * 0.08;
  }
  if (negativeSignals?.avoidCategories?.length > 0) {
    const allCategories = outfitItems.map(it => it.category?.toLowerCase()).filter(Boolean);
    const avoid         = negativeSignals.avoidCategories.map(c => c.toLowerCase());
    const penaltyCount  = allCategories.filter(c => avoid.includes(c)).length;
    if (penaltyCount > 0) score -= penaltyCount * 0.06;
  }
  if (negativeSignals?.avoidOccasions?.length > 0 && targetOccasion) {
    const avoid = negativeSignals.avoidOccasions.map(o => o.toLowerCase());
    if (avoid.includes(targetOccasion.toLowerCase())) score -= 0.05;
  }

  const personal = Math.max(0.10, Math.min(1, score));

  // Blend: personal behavior + collaborative signal when available.
  // (The ML acceptance-probability signal is deliberately NOT blended in here —
  // it would be circular, since the trained model takes this exact 9-dimension
  // score vector, including behaviorSignal, as its own input features. Instead
  // the ML signal is applied once, separately, in finalizeScore().)
  if (collaborativeSignal !== null && collaborativeSignal !== undefined) {
    return personal * 0.65 + collaborativeSignal * 0.35;
  }
  return personal;
}

// Festival color keyword map — maps festival.color hint to item color keywords
const FESTIVAL_COLOR_KEYWORDS = {
  'red':          ['red', 'crimson', 'maroon', 'vermillion', 'scarlet'],
  'red-pink':     ['red', 'pink', 'rose', 'crimson', 'fuchsia'],
  'warm':         ['gold', 'orange', 'yellow', 'amber', 'saffron', 'mustard'],
  'yellow-orange':['yellow', 'orange', 'amber', 'saffron', 'mustard'],
  'white':        ['white', 'ivory', 'cream', 'off-white'],
  'white-yellow': ['white', 'ivory', 'yellow', 'cream', 'saffron'],
  'purple':       ['purple', 'violet', 'lavender', 'mauve'],
  'muted':        ['beige', 'grey', 'cream', 'ivory', 'nude', 'stone', 'taupe'],
};

function calcTrendScore(outfitItems, insights = {}, kathContext = {}) {
  const allColors  = outfitItems.flatMap(extractColors).map(c => c.toLowerCase());
  const itemStyles = outfitItems.flatMap(inferItemStyles).map(s => s.toLowerCase());
  let score = 0.45;

  // Personal trend signals — items matching user's accelerating preferences
  if (insights.trendingColors?.length > 0 && allColors.length > 0) {
    const trending = insights.trendingColors.map(c => c.toLowerCase());
    const hits     = allColors.filter(c => trending.some(t => c.includes(t) || t.includes(c))).length;
    score += (hits / allColors.length) * 0.25;
  }

  if (insights.trendingStyles?.length > 0 && itemStyles.length > 0) {
    const trending = insights.trendingStyles.map(s => s.toLowerCase());
    const hits     = itemStyles.filter(s => trending.includes(s)).length;
    score += (hits / Math.max(1, itemStyles.length)) * 0.20;
  }

  // Kathmandu cultural relevance — traditional festival alignment
  const activeFestivals = kathContext.festivals?.current || [];
  const tradFestivals   = activeFestivals.filter(f => f.traditional);
  if (tradFestivals.length > 0) {
    // Traditional items during traditional festivals get a significant boost
    const hasTraditional = itemStyles.includes('traditional');
    if (hasTraditional) score += 0.15;

    // Festival color alignment — check if outfit colors match festival guidance
    for (const fest of tradFestivals) {
      const colorHints = FESTIVAL_COLOR_KEYWORDS[fest.color] || [];
      if (colorHints.length > 0 && allColors.length > 0) {
        const colorMatch = allColors.some(c => colorHints.some(h => c.includes(h)));
        if (colorMatch) { score += 0.10; break; }
      }
    }
  }

  // Non-traditional festivals (social events) — relevant style boost
  const socialFestivals = activeFestivals.filter(f => !f.traditional);
  if (socialFestivals.length > 0) {
    const hasCasualOrTrendy = itemStyles.some(s => ['casual', 'korean', 'y2k', 'minimalist'].includes(s));
    if (hasCasualOrTrendy) score += 0.05;
  }

  return Math.max(0.10, Math.min(1, score));
}

function calcBodyTypeScore(outfitItems, userProfile) {
  return rules.bodyTypeScore(outfitItems, userProfile.bodyType);
}

function calcFabricScore(outfitItems, userProfile) {
  return rules.fabricPreferenceScore(outfitItems, userProfile.fabricPreferences);
}

// Maps the user's onboarding comfort-priority answer (1-5, low = casual/
// laid-back, high = dressed-up/formal — see Onboarding.jsx's COMFORT scale)
// onto the same 1-4 formality scale outfit items use, then rewards outfits
// whose actual formality is close to what the user asked for. Neutral 0.5
// when either side of the comparison has no real signal, matching this
// file's existing "no forced guess" convention (see computeDresscodeFit).
function calcComfortScore(outfitItems, userProfile) {
  const comfortPriority = userProfile.comfortPriority;
  if (!Number.isFinite(comfortPriority) || comfortPriority < 1 || comfortPriority > 5) return 0.5;
  const actual = avgFormality(outfitItems);
  if (actual === null) return 0.5;
  const targetFormality = 1 + (comfortPriority - 1) * (3 / 4);
  return Math.max(0, 1 - Math.abs(actual - targetFormality) / 4);
}

// ── Wizard-only dimensions ───────────────────────────────────────────────────
// These 5 dimensions only carry real weight in the wizard_option_* categories
// (see config/scoringWeights.js) — every other category's weight vector never
// references these keys at all, so they're never summed in for the standard
// dashboard flow regardless of whether they were computed. Each function
// returns null (not a number) when its corresponding wizard field is unset,
// so finalizeScore's existing `?? 0.5` neutral fallback applies rather than
// guessing at a value with no real signal behind it.

const FORMALITY_KEYWORDS = [
  { re: /black[\s-]?tie|black tie|gala|ball/i,                    formality: 4 },
  { re: /formal|office|business|corporate|interview/i,             formality: 3 },
  { re: /smart[\s-]?casual|semi[\s-]?formal|date night|dinner/i,   formality: 2 },
  { re: /casual|relaxed|weekend|everyday|daily/i,                  formality: 1 },
  { re: /loungewear|home|comfy|lazy/i,                              formality: 0 },
];

function avgFormality(outfitItems) {
  const levels = outfitItems.map(it => it.formalityLevel).filter(l => Number.isInteger(l));
  if (!levels.length) return null;
  return levels.reduce((a, b) => a + b, 0) / levels.length;
}

// dresscode is free text (up to 100 chars) from the wizard, not an enum —
// keyword-matched against a small formality dictionary rather than assumed.
function computeDresscodeFit(outfitItems, dresscode) {
  if (!dresscode || !dresscode.trim()) return null;
  const match = FORMALITY_KEYWORDS.find(k => k.re.test(dresscode));
  if (!match) return null; // no recognizable keyword — genuinely no signal, not a guess
  const actual = avgFormality(outfitItems);
  if (actual === null) return null; // no wardrobe item in this outfit has formalityLevel set
  return Math.max(0, 1 - Math.abs(actual - match.formality) / 4);
}

function computeIndoorOutdoorFit(outfitSlots, indoorOutdoor, weather) {
  if (!indoorOutdoor || indoorOutdoor === 'both') return null;
  const layering = rules.getWeatherLayeringAdvice(weather?.temp);
  if (indoorOutdoor === 'outdoor') {
    // Outdoor exposure — reward outfits that actually followed the weather's
    // layering call (outerwear present when the weather required/recommended it).
    if (layering.requireOuterwear || layering.recommendOuterwear) {
      const outer = outfitSlots?.outerwear;
      return (outer?.item || outer?.suggestion) ? 0.85 : 0.45;
    }
    return 0.75;
  }
  return 0.70; // indoor — weather/layering matters less; mild neutral-positive
}

function hexToBrightness(hex) {
  if (typeof hex !== 'string') return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const r = parseInt(m[1].slice(0, 2), 16), g = parseInt(m[1].slice(2, 4), 16), b = parseInt(m[1].slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255; // 0 (black) .. 1 (white)
}

function computeDayNightFit(outfitItems, dayNight) {
  if (!dayNight || dayNight === 'both') return null;
  const brightness = outfitItems
    .flatMap(it => Array.isArray(it.colorHex) ? it.colorHex : [])
    .map(hexToBrightness)
    .filter(b => b !== null);
  const itemStyles = outfitItems.flatMap(inferItemStyles);
  const hasEveningStyle = itemStyles.some(s => ['classic', 'romantic', 'edgy'].includes(s));

  if (!brightness.length) return dayNight === 'night' && hasEveningStyle ? 0.7 : 0.6; // no color data — mild neutral

  const avgBrightness = brightness.reduce((a, b) => a + b, 0) / brightness.length;
  if (dayNight === 'day') return Math.max(0.3, avgBrightness);
  return Math.max(0.3, (1 - avgBrightness) * 0.7 + (hasEveningStyle ? 0.3 : 0)); // night
}

const VIBE_STYLE_MAP = {
  elegant:  ['classic', 'formal'],
  bold:     ['edgy', 'y2k'],
  minimal:  ['minimalist'],
  bohemian: ['boho', 'romantic'],
  street:   ['streetwear', 'korean', 'y2k'],
  classic:  ['classic', 'formal'],
  romantic: ['romantic', 'boho'],
  power:    ['formal', 'classic'],
  playful:  ['y2k', 'korean'],
  edgy:     ['edgy', 'streetwear'],
  cozy:     ['casual', 'korean'],
  sporty:   ['athleisure', 'sporty'],
};

function computeVibeMatch(outfitItems, vibe) {
  if (!vibe) return null;
  const targetStyles = VIBE_STYLE_MAP[vibe.toLowerCase()];
  if (!targetStyles) return null;
  const itemStyles = outfitItems.flatMap(inferItemStyles);
  if (!itemStyles.length) return 0.5;
  const hits = itemStyles.filter(s => targetStyles.includes(s)).length;
  return Math.min(1, 0.4 + (hits / itemStyles.length) * 0.9);
}

// ── Sub-score computation (category-independent) ────────────────────────────
// Computes the 9 raw 0-1 dimensions for one outfit candidate. Called ONCE per
// candidate by rankingService, before any category weighting or ML blending —
// this is the "score before explain" half of the pipeline inversion.
exports.computeSubScores = function computeSubScores(outfitItems, outfitSlots, userProfile, context, insights, signals = {}) {
  const negativeSignals = signals.negativeSignals || {};

  const scores = {
    styleMatch:     calcStyleMatchScore(outfitItems, userProfile),
    colorHarmony:   calcColorHarmonyScore(outfitItems),
    colorPref:      calcColorPreferenceScore(outfitItems, userProfile),
    occasionFit:    calcOccasionScore(outfitItems, context.occasion),
    weatherFit:     calcWeatherFitScore(outfitSlots, context.weather),
    behaviorSignal: calcBehaviorScore(outfitItems, insights, signals.collaborativeSignal, negativeSignals, context.occasion),
    bodyTypeMatch:  calcBodyTypeScore(outfitItems, userProfile),
    fabricMatch:    calcFabricScore(outfitItems, userProfile),
    trendScore:     calcTrendScore(outfitItems, insights, signals.kathmanduContext || {}),
    comfortMatch:   calcComfortScore(outfitItems, userProfile),
  };

  // Wizard-only — only present in `context` for wizard sessions (see
  // rankingService.rankForCategories's optional 5th argument). Omitted
  // entirely (not set to a default) when there's no real signal, so
  // finalizeScore's `?? 0.5` neutral fallback is what actually applies.
  const dresscodeFit     = computeDresscodeFit(outfitItems, context.dresscode);
  const indoorOutdoorFit = computeIndoorOutdoorFit(outfitSlots, context.indoorOutdoor, context.weather);
  const dayNightFit      = computeDayNightFit(outfitItems, context.dayNight);
  const vibeMatch        = computeVibeMatch(outfitItems, context.vibe);

  if (dresscodeFit     !== null) scores.dresscodeFit     = dresscodeFit;
  if (indoorOutdoorFit !== null) scores.indoorOutdoorFit = indoorOutdoorFit;
  if (dayNightFit      !== null) scores.dayNightFit      = dayNightFit;
  if (vibeMatch        !== null) scores.vibeMatch        = vibeMatch;

  return scores;
};

// ── Category-weighted finalization ───────────────────────────────────────────
// Applies category weights to the 10 sub-scores, then optionally blends in the
// trained ML acceptance-probability as one further, separate signal (kept
// outside the 10 dimensions entirely to avoid the circularity of feeding a
// model's own inputs back into itself).
//
// Note: the Polyvore-trained compat model's `datasetCompatProbability` (see
// rankingService.js/mlBridgeService.js) is deliberately NOT threaded through
// here or blended into `confidence` — Phase 1 keeps it a visible, independent
// signal attached directly to the ranked result and persisted Recommendation
// doc ("does a model trained on real curated human outfits agree with our
// own ranking?"), not folded into this function's weighted math. Blending it
// in is a later phase, gated on backtesting it against real Recommendation
// outcomes to justify a specific weight — see POLYVORE_COMPAT.md.
exports.finalizeScore = function finalizeScore(scores, category = 'best_match', mlAcceptanceProbability = null) {
  const weights = CATEGORY_WEIGHTS[category] || CATEGORY_WEIGHTS.best_match;

  const weighted = Object.entries(weights).reduce((sum, [key, w]) => {
    return sum + (scores[key] ?? 0.5) * w;
  }, 0);

  const finalScore = (mlAcceptanceProbability !== null && mlAcceptanceProbability !== undefined)
    ? weighted * 0.85 + mlAcceptanceProbability * 0.15
    : weighted;

  const confidence = Math.round(Math.max(10, Math.min(99, finalScore * 100)));
  // Standalone rule-based score (0-1), before any ML blend — persisted
  // separately (Recommendation.ruleScore) so a real hybrid-vs-rule-only
  // comparison can be run retrospectively without recomputing anything.
  const ruleScore = Math.max(0, Math.min(1, weighted));

  const breakdown = {
    'Style Match':      Math.round(scores.styleMatch     * 100),
    'Color Harmony':    Math.round(scores.colorHarmony   * 100),
    'Color Preference': Math.round(scores.colorPref      * 100),
    'Occasion Fit':     Math.round(scores.occasionFit    * 100),
    'Weather Fit':      Math.round(scores.weatherFit     * 100),
    'Behavior Match':   Math.round(scores.behaviorSignal * 100),
    'Body Type Match':  Math.round(scores.bodyTypeMatch  * 100),
    'Fabric Match':     Math.round(scores.fabricMatch    * 100),
    'Trend Score':      Math.round(scores.trendScore     * 100),
    'Comfort Match':    Math.round(scores.comfortMatch    * 100),
  };
  // Wizard-only dimensions — only added to the breakdown when they were
  // actually computed (i.e. a wizard session supplied real signal for them),
  // so the standard 10-dimension XAI panel radar chart is completely unaffected.
  if (scores.dresscodeFit     !== undefined) breakdown['Dresscode Fit']      = Math.round(scores.dresscodeFit     * 100);
  if (scores.indoorOutdoorFit !== undefined) breakdown['Indoor/Outdoor Fit'] = Math.round(scores.indoorOutdoorFit * 100);
  if (scores.dayNightFit      !== undefined) breakdown['Day/Night Fit']     = Math.round(scores.dayNightFit      * 100);
  if (scores.vibeMatch        !== undefined) breakdown['Vibe Match']        = Math.round(scores.vibeMatch        * 100);

  return { confidence, breakdown, ruleScore };
};

exports.generateScoreNarrative = function(scores, category, context) {
  const high = (v) => v >= 0.8;
  const mid  = (v) => v >= 0.6;

  const lines = [];

  if (high(scores.styleMatch))       lines.push('matches your personal style preferences strongly');
  else if (mid(scores.styleMatch))   lines.push('aligns reasonably well with your style profile');
  else                               lines.push('is a style stretch that could broaden your fashion range');

  if (high(scores.colorHarmony))     lines.push('features beautiful color harmony');
  else if (mid(scores.colorHarmony)) lines.push('has a workable color balance');

  if (high(scores.colorPref))        lines.push('uses colors you love and flatters your skin tone');

  if (high(scores.occasionFit))      lines.push(`is perfectly suited for ${context.occasion || 'this occasion'}`);
  else if (!mid(scores.occasionFit)) lines.push(`is less conventional for ${context.occasion || 'this occasion'} but can work with the right styling`);

  if (scores.weatherFit < 0.5)       lines.push('may need layering adjustments for today\'s weather');
  else if (high(scores.weatherFit))  lines.push('is ideal for today\'s Kathmandu weather');

  if (high(scores.behaviorSignal))   lines.push('reflects patterns from your wardrobe usage and peer style data');
  if (high(scores.bodyTypeMatch))    lines.push('is well-suited to your body type');
  if (high(scores.fabricMatch))      lines.push('uses fabrics that match your preferences');

  return lines.length > 0
    ? 'This outfit ' + lines.join(', ') + '.'
    : 'This outfit was selected as a strong overall match for your profile and context.';
};

// Fingerprint: sorted item names (or item id strings) from all filled slots.
// Shared by within-session exact-duplicate removal (below) and cross-session
// "recently served" exclusion (contextEngine.getRecentlyServedFingerprints).
exports.fingerprintOutfit = function fingerprintOutfit(outfitSlots) {
  return Object.values(outfitSlots || {})
    .map(s => s?.name || (s?.item ? s.item.toString() : ''))
    .filter(Boolean)
    .sort()
    .join('|');
};

exports.deduplicateRecommendations = function(scoredRecs) {
  const seen     = new Set();
  const unique   = [];

  for (const rec of scoredRecs) {
    const key = exports.fingerprintOutfit(rec.outfit);

    if (key && seen.has(key)) {
      continue;
    }

    if (key) seen.add(key);
    unique.push(rec);
  }

  return unique;
};
