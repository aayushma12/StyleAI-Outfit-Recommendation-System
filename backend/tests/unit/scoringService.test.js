'use strict';

const scoring = require('../../services/scoringService');

const SCORE_KEYS = [
  'styleMatch', 'colorHarmony', 'colorPref', 'occasionFit', 'weatherFit',
  'behaviorSignal', 'bodyTypeMatch', 'fabricMatch', 'trendScore',
];

const sampleOutfitItems = [
  { name: 'White Cotton Shirt', category: 'tops', color: 'white', occasion: 'office' },
  { name: 'Black Trousers', category: 'bottoms', color: 'black', occasion: 'office' },
];

const sampleUser = {
  stylePreferences: ['classic'],
  fashionStyles: ['minimalist'],
  skinTone: 'medium',
  colorPreferences: ['white', 'black'],
  dislikedColors: [],
  bodyType: 'hourglass',
  fabricPreferences: ['cotton'],
};

const sampleContext = { occasion: 'office', weather: { temp: 20 } };
const sampleInsights = { hasHistory: false };

describe('scoringService.computeSubScores', () => {
  test('returns all 9 dimensions, each within [0, 1]', () => {
    const scores = scoring.computeSubScores(sampleOutfitItems, {}, sampleUser, sampleContext, sampleInsights, {});
    expect(Object.keys(scores).sort()).toEqual(SCORE_KEYS.sort());
    for (const key of SCORE_KEYS) {
      expect(scores[key]).toBeGreaterThanOrEqual(0);
      expect(scores[key]).toBeLessThanOrEqual(1);
    }
  });

  test('does not require an ML signal — it is applied later in finalizeScore, not here', () => {
    // No `mlSignal`/`mlPredictions` passed in signals; should not throw or behave differently.
    expect(() => scoring.computeSubScores(sampleOutfitItems, {}, sampleUser, sampleContext, sampleInsights, {})).not.toThrow();
  });
});

describe('scoringService.finalizeScore', () => {
  const subScores = { styleMatch: 0.8, colorHarmony: 0.8, colorPref: 0.8, occasionFit: 0.8, weatherFit: 0.8, behaviorSignal: 0.8, bodyTypeMatch: 0.8, fabricMatch: 0.8, trendScore: 0.8 };

  test('produces a confidence between 10 and 99 and a full breakdown', () => {
    const { confidence, breakdown } = scoring.finalizeScore(subScores, 'best_match');
    expect(confidence).toBeGreaterThanOrEqual(10);
    expect(confidence).toBeLessThanOrEqual(99);
    expect(breakdown['Style Match']).toBe(80);
  });

  test('falls back to the best_match weight vector for an unknown category', () => {
    const known = scoring.finalizeScore(subScores, 'best_match');
    const unknown = scoring.finalizeScore(subScores, 'not_a_real_category');
    expect(unknown.confidence).toBe(known.confidence);
  });

  test('blending a high ML acceptance probability raises confidence; a low one lowers it', () => {
    const noMl   = scoring.finalizeScore(subScores, 'best_match', null);
    const highMl = scoring.finalizeScore(subScores, 'best_match', 0.99);
    const lowMl  = scoring.finalizeScore(subScores, 'best_match', 0.01);
    expect(highMl.confidence).toBeGreaterThanOrEqual(noMl.confidence);
    expect(lowMl.confidence).toBeLessThanOrEqual(noMl.confidence);
  });
});

describe('scoringService.generateScoreNarrative', () => {
  test('produces a non-empty, readable sentence from a score set', () => {
    const subScores = { styleMatch: 0.9, colorHarmony: 0.9, colorPref: 0.9, occasionFit: 0.9, weatherFit: 0.9, behaviorSignal: 0.9, bodyTypeMatch: 0.9, fabricMatch: 0.9, trendScore: 0.9 };
    const narrative = scoring.generateScoreNarrative(subScores, 'best_match', { occasion: 'office' });
    expect(typeof narrative).toBe('string');
    expect(narrative.length).toBeGreaterThan(10);
    expect(narrative).toMatch(/office/);
  });

  test('never throws even with a sparse/empty score object', () => {
    expect(() => scoring.generateScoreNarrative({}, 'best_match', {})).not.toThrow();
  });
});

describe('scoringService.deduplicateRecommendations', () => {
  test('drops recommendations with an identical set of filled slot names', () => {
    const outfitA = { outfit: { top: { name: 'Shirt' }, bottom: { name: 'Jeans' } } };
    const outfitB = { outfit: { top: { name: 'Shirt' }, bottom: { name: 'Jeans' } } }; // same items -> duplicate
    const outfitC = { outfit: { top: { name: 'Blouse' }, bottom: { name: 'Skirt' } } }; // genuinely different

    const result = scoring.deduplicateRecommendations([outfitA, outfitB, outfitC]);
    expect(result.length).toBe(2);
  });

  test('keeps outfits with empty slots (no fingerprint) rather than incorrectly merging them', () => {
    const empty1 = { outfit: {} };
    const empty2 = { outfit: {} };
    const result = scoring.deduplicateRecommendations([empty1, empty2]);
    expect(result.length).toBe(2);
  });
});

describe('scoringService.fingerprintOutfit', () => {
  test('same items produce the same fingerprint regardless of slot key order', () => {
    const a = scoring.fingerprintOutfit({ top: { name: 'Shirt' }, bottom: { name: 'Jeans' } });
    const b = scoring.fingerprintOutfit({ bottom: { name: 'Jeans' }, top: { name: 'Shirt' } });
    expect(a).toBe(b);
  });

  test('different items produce different fingerprints', () => {
    const a = scoring.fingerprintOutfit({ top: { name: 'Shirt' }, bottom: { name: 'Jeans' } });
    const b = scoring.fingerprintOutfit({ top: { name: 'Blouse' }, bottom: { name: 'Skirt' } });
    expect(a).not.toBe(b);
  });

  test('falls back to the item id when a slot has no name', () => {
    const fp = scoring.fingerprintOutfit({ top: { item: '507f1f77bcf86cd799439011' } });
    expect(fp).toBe('507f1f77bcf86cd799439011');
  });
});

describe('scoringService.computeSubScores — negative signal penalties', () => {
  test('avoidCategories lowers behaviorSignal versus no negative signals', () => {
    const signals = { negativeSignals: { avoidCategories: ['tops'] } };
    const withPenalty = scoring.computeSubScores(sampleOutfitItems, {}, sampleUser, sampleContext, sampleInsights, signals);
    const without      = scoring.computeSubScores(sampleOutfitItems, {}, sampleUser, sampleContext, sampleInsights, {});
    expect(withPenalty.behaviorSignal).toBeLessThan(without.behaviorSignal);
  });

  test('avoidOccasions lowers behaviorSignal only when it matches the target occasion', () => {
    const matching    = { negativeSignals: { avoidOccasions: ['office'] } };
    const nonMatching = { negativeSignals: { avoidOccasions: ['party'] } };
    const base    = scoring.computeSubScores(sampleOutfitItems, {}, sampleUser, sampleContext, sampleInsights, {});
    const matched = scoring.computeSubScores(sampleOutfitItems, {}, sampleUser, sampleContext, sampleInsights, matching);
    const missed  = scoring.computeSubScores(sampleOutfitItems, {}, sampleUser, sampleContext, sampleInsights, nonMatching);
    expect(matched.behaviorSignal).toBeLessThan(base.behaviorSignal);
    expect(missed.behaviorSignal).toBe(base.behaviorSignal);
  });
});

describe('scoringService.CATEGORY_WEIGHTS', () => {
  test('every category weight vector sums to ~1.0', () => {
    for (const [, weights] of Object.entries(scoring.CATEGORY_WEIGHTS)) {
      const sum = Object.values(weights).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 1);
    }
  });

  test('only the 3 wizard categories carry the 5 new wizard-only dimensions', () => {
    const wizardOnlyKeys = ['dresscodeFit', 'indoorOutdoorFit', 'dayNightFit', 'vibeMatch', 'budgetFit'];
    for (const [category, weights] of Object.entries(scoring.CATEGORY_WEIGHTS)) {
      const hasWizardKeys = wizardOnlyKeys.some(k => k in weights);
      expect(hasWizardKeys).toBe(category.startsWith('wizard_option_'));
    }
  });
});

describe('scoringService.computeSubScores — wizard-only dimensions', () => {
  const formalOutfit = [
    { name: 'Blazer', category: 'jackets', color: 'black', occasion: 'office', formalityLevel: 4, colorHex: ['#111111'] },
    { name: 'Trousers', category: 'bottoms', color: 'black', occasion: 'office', formalityLevel: 4, colorHex: ['#111111'] },
  ];
  test('absent when no wizard fields are supplied — non-wizard sessions get exactly the original 9 keys', () => {
    const scores = scoring.computeSubScores(sampleOutfitItems, {}, sampleUser, sampleContext, sampleInsights, {});
    expect(Object.keys(scores).sort()).toEqual(SCORE_KEYS.sort());
  });

  test('dresscodeFit rewards a formal outfit for a formal dresscode and penalizes it for a casual one', () => {
    const formalCtx = { ...sampleContext, dresscode: 'formal office attire' };
    const casualCtx = { ...sampleContext, dresscode: 'casual weekend' };
    const forFormalDress = scoring.computeSubScores(formalOutfit, {}, sampleUser, formalCtx, sampleInsights, {});
    const forCasualDress = scoring.computeSubScores(formalOutfit, {}, sampleUser, casualCtx, sampleInsights, {});
    expect(forFormalDress.dresscodeFit).toBeGreaterThan(forCasualDress.dresscodeFit);
  });

  test('dresscodeFit is absent (not neutral-guessed) when the free text has no recognizable keyword', () => {
    const ctx = { ...sampleContext, dresscode: 'asdkjasnd nonsense text' };
    const scores = scoring.computeSubScores(formalOutfit, {}, sampleUser, ctx, sampleInsights, {});
    expect(scores.dresscodeFit).toBeUndefined();
  });

  test('vibeMatch scores higher for a vibe whose mapped styles match the outfit', () => {
    const elegantCtx = { ...sampleContext, vibe: 'Elegant' };
    const sportyCtx  = { ...sampleContext, vibe: 'Sporty' };
    const forElegant = scoring.computeSubScores(formalOutfit, {}, sampleUser, elegantCtx, sampleInsights, {});
    const forSporty  = scoring.computeSubScores(formalOutfit, {}, sampleUser, sportyCtx, sampleInsights, {});
    expect(forElegant.vibeMatch).toBeGreaterThan(forSporty.vibeMatch);
  });

  test('dayNightFit rewards brighter outfits for day and deeper-toned outfits for night', () => {
    const brightOutfit = [{ name: 'White Top', category: 'tops', color: 'white', colorHex: ['#ffffff'] }];
    const dayScore   = scoring.computeSubScores(brightOutfit, {}, sampleUser, { ...sampleContext, dayNight: 'day' },   sampleInsights, {});
    const nightScore = scoring.computeSubScores(brightOutfit, {}, sampleUser, { ...sampleContext, dayNight: 'night' }, sampleInsights, {});
    expect(dayScore.dayNightFit).toBeGreaterThan(nightScore.dayNightFit);
  });

  test('dayNightFit/indoorOutdoorFit/dresscodeFit are absent when the value is "both"/unset (no forced guess)', () => {
    const scores = scoring.computeSubScores(sampleOutfitItems, {}, sampleUser,
      { ...sampleContext, dayNight: 'both', indoorOutdoor: 'both' }, sampleInsights, {});
    expect(scores.dayNightFit).toBeUndefined();
    expect(scores.indoorOutdoorFit).toBeUndefined();
  });

  test('budgetFit rewards owned-heavy outfits more for a "budget" tier than a "luxury" tier', () => {
    const mostlySuggestedSlots = {
      top: { name: 'Owned Top', item: 'x' }, bottom: { suggestion: 'suggested bottoms' },
      footwear: { suggestion: 'suggested shoes' }, jewelry: { suggestion: 'suggested jewelry' },
    };
    const budgetScores  = scoring.computeSubScores(sampleOutfitItems, mostlySuggestedSlots, sampleUser, { ...sampleContext, budget: 'budget' },  sampleInsights, {});
    const luxuryScores  = scoring.computeSubScores(sampleOutfitItems, mostlySuggestedSlots, sampleUser, { ...sampleContext, budget: 'luxury' }, sampleInsights, {});
    expect(budgetScores.budgetFit).toBeLessThan(luxuryScores.budgetFit);
  });
});
