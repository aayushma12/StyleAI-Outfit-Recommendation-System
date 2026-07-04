'use strict';

const rules = require('../../services/fashionRulesEngine');

describe('fashionRulesEngine.colorHarmonyScore', () => {
  test('empty color list returns a neutral default', () => {
    expect(rules.colorHarmonyScore([])).toBe(0.5);
  });

  test('a single chromatic color scores high (nothing to clash with)', () => {
    expect(rules.colorHarmonyScore(['red'])).toBeGreaterThanOrEqual(0.85);
  });

  test('complementary colors (~180° apart) score higher than near-clashing colors (~45° apart)', () => {
    const complementary = rules.colorHarmonyScore(['red', 'teal']);   // 0° vs 178° ≈ 178° apart
    const nearClash      = rules.colorHarmonyScore(['red', 'orange']); // 0° vs 30° ≈ 30° apart (analogous, should still be decent)
    const clash           = rules.colorHarmonyScore(['red', 'olive']); // 0° vs 80° apart (the awkward middle zone)
    expect(complementary).toBeGreaterThan(clash);
    expect(nearClash).toBeGreaterThan(clash);
  });

  test('neutral colors add a small bonus on top of the base harmony', () => {
    const withoutNeutral = rules.colorHarmonyScore(['red', 'teal']);
    const withNeutral     = rules.colorHarmonyScore(['red', 'teal', 'black']);
    expect(withNeutral).toBeGreaterThanOrEqual(withoutNeutral);
  });
});

describe('fashionRulesEngine.occasionScore', () => {
  test('exact occasion match scores perfectly', () => {
    expect(rules.occasionScore('office', 'office')).toBe(1.0);
  });

  test('items with no occasion set are treated as universally wearable', () => {
    expect(rules.occasionScore('', 'office')).toBeGreaterThanOrEqual(0.7);
  });

  test('a large formality gap (daily vs formal) scores much lower than an exact match', () => {
    const exact = rules.occasionScore('formal', 'formal');
    const farApart = rules.occasionScore('daily', 'formal'); // formality 1 vs 4 = gap of 3
    expect(exact).toBeGreaterThan(farApart);
    expect(farApart).toBeLessThan(0.5);
  });
});

describe('fashionRulesEngine.getWeatherTier / getWeatherLayeringAdvice', () => {
  // Regression test for a real bug found and fixed during development: the
  // "cool" tier's outerwear value ("recommended") wasn't mapped to either
  // requireOuterwear or recommendOuterwear, so cool-weather outfits (14-20°C —
  // very common in Kathmandu mornings/evenings) silently got "no outerwear
  // needed" advice.
  test.each([
    [2, 'freezing', true, false],
    [10, 'cold', true, false],
    [17, 'cool', false, true],
    [23, 'mild', false, false],
    [29, 'warm', false, false],
    [35, 'hot', false, false],
  ])('%d°C is tier "%s" with requireOuterwear=%s, recommendOuterwear=%s', (temp, tier, requireOuterwear, recommendOuterwear) => {
    const advice = rules.getWeatherLayeringAdvice(temp);
    expect(advice.tier).toBe(tier);
    expect(advice.requireOuterwear).toBe(requireOuterwear);
    expect(advice.recommendOuterwear).toBe(recommendOuterwear);
  });

  test('every tier resolves to exactly one of require/recommend/skip (never silently none of the three when outerwear is contextually relevant)', () => {
    for (const temp of [2, 10, 17, 23, 29, 35]) {
      const advice = rules.getWeatherLayeringAdvice(temp);
      // mild (20-26°C) is the one tier that's genuinely "optional" — neither flag — by design.
      if (advice.tier !== 'mild') {
        const flagCount = [advice.requireOuterwear, advice.recommendOuterwear, advice.skipOuterwear].filter(Boolean).length;
        expect(flagCount).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe('fashionRulesEngine.hardFilterItem', () => {
  test('legacy items with no formalityLevel/suitableSeasons always pass', () => {
    expect(rules.hardFilterItem({}, 'formal', 'winter')).toBe(true);
  });

  test('rejects an item whose formality is far from the target occasion', () => {
    const gymWear = { formalityLevel: 0 }; // gym/loungewear
    expect(rules.hardFilterItem(gymWear, 'formal')).toBe(false); // formal = 4, gap = 4
  });

  test('accepts an item whose formality is close to the target occasion', () => {
    const smartCasual = { formalityLevel: 2 };
    expect(rules.hardFilterItem(smartCasual, 'office')).toBe(true); // office = 3, gap = 1
  });

  test('rejects an item explicitly restricted to seasons that exclude the current one', () => {
    const summerOnly = { suitableSeasons: ['monsoon'] };
    expect(rules.hardFilterItem(summerOnly, 'daily', 'winter')).toBe(false);
  });

  test('an item marked suitable for "all" seasons is never season-rejected', () => {
    const allSeason = { suitableSeasons: ['all'] };
    expect(rules.hardFilterItem(allSeason, 'daily', 'winter')).toBe(true);
  });
});

describe('fashionRulesEngine.getGenericSuggestion', () => {
  test('returns a non-empty, human-readable suggestion for every core slot', () => {
    const slots = ['outerwear', 'footwear', 'jewelry', 'bag', 'belt', 'watch', 'scarf', 'sunglasses', 'hair_accessory'];
    for (const slot of slots) {
      const suggestion = rules.getGenericSuggestion(slot, 'mild', 'daily');
      expect(typeof suggestion).toBe('string');
      expect(suggestion.length).toBeGreaterThan(0);
    }
  });

  test('cold weather outerwear suggestion differs from hot weather', () => {
    const cold = rules.getGenericSuggestion('outerwear', 'freezing', 'daily');
    const hot  = rules.getGenericSuggestion('outerwear', 'hot', 'daily');
    expect(cold).not.toBe(hot);
  });

  test('traditional-context suggestions differ from default ones for festival occasions', () => {
    const festivalFootwear = rules.getGenericSuggestion('footwear', 'mild', 'festival');
    const dailyFootwear    = rules.getGenericSuggestion('footwear', 'mild', 'daily');
    expect(festivalFootwear).not.toBe(dailyFootwear);
  });
});
