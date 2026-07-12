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

  test('a large formality gap (daily vs traditional) scores much lower than an exact match', () => {
    const exact = rules.occasionScore('traditional', 'traditional');
    const farApart = rules.occasionScore('daily', 'traditional'); // formality 1 vs 4 = gap of 3
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
    expect(rules.hardFilterItem({}, 'traditional', 'winter')).toBe(true);
  });

  test('rejects an item whose formality is far from the target occasion', () => {
    const gymWear = { formalityLevel: 0 }; // gym/loungewear
    expect(rules.hardFilterItem(gymWear, 'traditional')).toBe(false); // traditional = 4, gap = 4
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

describe('fashionRulesEngine.OCCASION_META completeness', () => {
  test('has an entry for every canonical occasion value', () => {
    const { OCCASIONS } = require('../../constants/occasions');
    for (const occ of OCCASIONS) {
      expect(rules.OCCASION_META[occ]).toBeDefined();
    }
  });
});

describe('fashionRulesEngine.hardFilterItem — footwear/accessory occasion rules', () => {
  test('rejects sneakers for the traditional/wedding group', () => {
    const sneakers = { subcategory: 'sneakers', name: 'White Sneakers', formalityLevel: 1 };
    expect(rules.hardFilterItem(sneakers, 'traditional', null, 'footwear')).toBe(false);
  });

  test('rejects sneakers for the office/formal group', () => {
    const sneakers = { subcategory: 'sneakers', name: 'White Sneakers', formalityLevel: 1 };
    expect(rules.hardFilterItem(sneakers, 'office', null, 'footwear')).toBe(false);
  });

  test('accepts sneakers for the daily/college group', () => {
    const sneakers = { subcategory: 'sneakers', name: 'White Sneakers', formalityLevel: 1 };
    expect(rules.hardFilterItem(sneakers, 'daily', null, 'footwear')).toBe(true);
  });

  test('accepts sneakers for the sports/gym group', () => {
    const sneakers = { subcategory: 'sneakers', name: 'White Sneakers', formalityLevel: 0 };
    expect(rules.hardFilterItem(sneakers, 'sports', null, 'footwear')).toBe(true);
  });

  test('rejects a heavy bridal accessory for the daily/college group', () => {
    const bridalNecklace = { subcategory: 'bridal necklace', name: 'Bridal Necklace', formalityLevel: 3 };
    expect(rules.hardFilterItem(bridalNecklace, 'daily', null, 'jewelry')).toBe(false);
  });

  test('rejects a heavy bridal accessory for the office/formal group (minimal professional styling)', () => {
    const bridalNecklace = { subcategory: 'bridal necklace', name: 'Bridal Necklace', formalityLevel: 3 };
    expect(rules.hardFilterItem(bridalNecklace, 'office', null, 'jewelry')).toBe(false);
  });

  test('accepts a heavy bridal accessory only for the traditional/festival/wedding group', () => {
    const bridalNecklace = { subcategory: 'bridal necklace', name: 'Bridal Necklace', formalityLevel: 3 };
    expect(rules.hardFilterItem(bridalNecklace, 'traditional', null, 'jewelry')).toBe(true);
  });

  test('a light accessory is never hard-rejected, even on the traditional group', () => {
    const simpleStuds = { subcategory: 'simple stud earrings', name: 'Simple Studs', formalityLevel: 1 };
    expect(rules.hardFilterItem(simpleStuds, 'traditional', null, 'jewelry')).toBe(true);
  });
});

describe('fashionRulesEngine.classifyAccessoryWeight', () => {
  test('classifies bridal/statement keywords as heavy', () => {
    expect(rules.classifyAccessoryWeight({ subcategory: 'chunky statement necklace' })).toBe('heavy');
  });
  test('classifies simple/minimal keywords as light', () => {
    expect(rules.classifyAccessoryWeight({ subcategory: 'simple stud earrings' })).toBe('light');
  });
  test('defaults to moderate when no keyword matches', () => {
    expect(rules.classifyAccessoryWeight({ subcategory: 'gold hoop earrings' })).toBe('moderate');
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

  test('traditional-context suggestions differ from default ones for the daily group', () => {
    const traditionalFootwear = rules.getGenericSuggestion('footwear', 'mild', 'traditional');
    const dailyFootwear       = rules.getGenericSuggestion('footwear', 'mild', 'daily');
    expect(traditionalFootwear).not.toBe(dailyFootwear);
  });
});
