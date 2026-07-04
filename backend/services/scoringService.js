'use strict';

const rules = require('./fashionRulesEngine');

// ── Category scoring weights ──────────────────────────────────────────────────
// 9 dimensions (trendScore added as 9th). Weights sum to 1.0 per category.
// Single source of truth — served to frontend via GET /recommendations/weights.
const CATEGORY_WEIGHTS = {
  best_match: {
    styleMatch:    0.18, colorHarmony:  0.12, colorPref:     0.12,
    occasionFit:   0.16, weatherFit:    0.12, behaviorSignal:0.09,
    bodyTypeMatch: 0.08, fabricMatch:   0.07, trendScore:    0.06,
  },
  most_stylish: {
    styleMatch:    0.22, colorHarmony:  0.22, colorPref:     0.19,
    occasionFit:   0.08, weatherFit:    0.00, behaviorSignal:0.05,
    bodyTypeMatch: 0.07, fabricMatch:   0.06, trendScore:    0.11,
  },
  most_comfortable: {
    styleMatch:    0.07, colorHarmony:  0.04, colorPref:     0.11,
    occasionFit:   0.07, weatherFit:    0.30, behaviorSignal:0.20,
    bodyTypeMatch: 0.09, fabricMatch:   0.10, trendScore:    0.02,
  },
  weather_optimized: {
    styleMatch:    0.07, colorHarmony:  0.03, colorPref:     0.07,
    occasionFit:   0.16, weatherFit:    0.44, behaviorSignal:0.05,
    bodyTypeMatch: 0.04, fabricMatch:   0.09, trendScore:    0.05,
  },
  wardrobe_champion: {
    styleMatch:    0.18, colorHarmony:  0.15, colorPref:     0.15,
    occasionFit:   0.16, weatherFit:    0.08, behaviorSignal:0.05,
    bodyTypeMatch: 0.09, fabricMatch:   0.08, trendScore:    0.06,
  },
  // Wizard categories — match-optimised
  wizard_option_1: {
    styleMatch:    0.20, colorHarmony:  0.14, colorPref:     0.13,
    occasionFit:   0.18, weatherFit:    0.10, behaviorSignal:0.08,
    bodyTypeMatch: 0.08, fabricMatch:   0.07, trendScore:    0.02,
  },
  wizard_option_2: {
    styleMatch:    0.21, colorHarmony:  0.19, colorPref:     0.14,
    occasionFit:   0.14, weatherFit:    0.06, behaviorSignal:0.07,
    bodyTypeMatch: 0.07, fabricMatch:   0.06, trendScore:    0.06,
  },
  wizard_option_3: {
    styleMatch:    0.22, colorHarmony:  0.14, colorPref:     0.13,
    occasionFit:   0.16, weatherFit:    0.08, behaviorSignal:0.09,
    bodyTypeMatch: 0.08, fabricMatch:   0.07, trendScore:    0.03,
  },
};

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

// ── Sub-score computation (category-independent) ────────────────────────────
// Computes the 9 raw 0-1 dimensions for one outfit candidate. Called ONCE per
// candidate by rankingService, before any category weighting or ML blending —
// this is the "score before explain" half of the pipeline inversion.
exports.computeSubScores = function computeSubScores(outfitItems, outfitSlots, userProfile, context, insights, signals = {}) {
  const negativeSignals = signals.negativeSignals || {};

  return {
    styleMatch:     calcStyleMatchScore(outfitItems, userProfile),
    colorHarmony:   calcColorHarmonyScore(outfitItems),
    colorPref:      calcColorPreferenceScore(outfitItems, userProfile),
    occasionFit:    calcOccasionScore(outfitItems, context.occasion),
    weatherFit:     calcWeatherFitScore(outfitSlots, context.weather),
    behaviorSignal: calcBehaviorScore(outfitItems, insights, signals.collaborativeSignal, negativeSignals, context.occasion),
    bodyTypeMatch:  calcBodyTypeScore(outfitItems, userProfile),
    fabricMatch:    calcFabricScore(outfitItems, userProfile),
    trendScore:     calcTrendScore(outfitItems, insights, signals.kathmanduContext || {}),
  };
};

// ── Category-weighted finalization ───────────────────────────────────────────
// Applies category weights to the 9 sub-scores, then optionally blends in the
// trained ML acceptance-probability as one further, separate signal (kept
// outside the 9 dimensions entirely to avoid the circularity of feeding a
// model's own inputs back into itself).
exports.finalizeScore = function finalizeScore(scores, category = 'best_match', mlAcceptanceProbability = null) {
  const weights = CATEGORY_WEIGHTS[category] || CATEGORY_WEIGHTS.best_match;

  const weighted = Object.entries(weights).reduce((sum, [key, w]) => {
    return sum + (scores[key] ?? 0.5) * w;
  }, 0);

  const finalScore = (mlAcceptanceProbability !== null && mlAcceptanceProbability !== undefined)
    ? weighted * 0.85 + mlAcceptanceProbability * 0.15
    : weighted;

  const confidence = Math.round(Math.max(10, Math.min(99, finalScore * 100)));

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
  };

  return { confidence, breakdown };
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
