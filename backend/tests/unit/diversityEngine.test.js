'use strict';

const diversityEngine = require('../../services/diversityEngine');
const scoring = require('../../services/scoringService');

function mkScored(confidence, sourceItemIds, needsSuggestion = [], slots = {}) {
  return {
    candidate: { slots, needsSuggestion, sourceItemIds },
    outfitItems: [],
    subScores: {},
    mlAcceptanceProbability: null,
    confidence,
    breakdown: {},
  };
}

const CATEGORIES = [
  { key: 'best_match', label: 'Best Match' },
  { key: 'most_stylish', label: 'Most Stylish' },
  { key: 'wardrobe_champion', label: 'From Your Wardrobe' },
];

describe('diversityEngine.selectDiverse', () => {
  test('picks the top-ranked candidate for the first category', () => {
    const ranked = {
      best_match: [mkScored(90, ['a', 'b']), mkScored(80, ['c', 'd'])],
      most_stylish: [mkScored(85, ['a', 'b']), mkScored(70, ['e', 'f'])],
      wardrobe_champion: [mkScored(75, ['g', 'h'])],
    };
    const selected = diversityEngine.selectDiverse(ranked, CATEGORIES, {});
    expect(selected[0].scored.confidence).toBe(90);
  });

  test('avoids picking a heavily-overlapping candidate for a later category when a distinct alternative exists', () => {
    const ranked = {
      best_match:   [mkScored(90, ['shirt', 'jeans', 'sneakers'])],
      // most_stylish's top pick overlaps 100% with best_match's pick; a distinct
      // (lower-scored) alternative should be chosen instead.
      most_stylish: [
        mkScored(88, ['shirt', 'jeans', 'sneakers']),
        mkScored(75, ['blouse', 'skirt', 'heels']),
      ],
      wardrobe_champion: [mkScored(70, ['kurta', 'leggings', 'flats'])],
    };
    const selected = diversityEngine.selectDiverse(ranked, CATEGORIES, {});
    const stylistPick = selected.find(s => s.catMeta.key === 'most_stylish');
    expect(stylistPick.scored.confidence).toBe(75); // the distinct alternative, not the 88-confidence duplicate
  });

  test('the "wardrobe" category is restricted to fully-owned candidates (needsSuggestion empty) when any exist', () => {
    const ranked = {
      best_match: [mkScored(90, ['a'])],
      most_stylish: [mkScored(85, ['b'])],
      wardrobe_champion: [
        mkScored(95, ['c'], ['footwear']),       // higher score but needs a suggestion
        mkScored(80, ['d'], []),                  // fully owned
      ],
    };
    const selected = diversityEngine.selectDiverse(ranked, CATEGORIES, {});
    const champion = selected.find(s => s.catMeta.key === 'wardrobe_champion');
    expect(champion.scored.candidate.needsSuggestion.length).toBe(0);
  });

  test('skips a category entirely if its ranked pool is empty, rather than throwing', () => {
    const ranked = {
      best_match: [mkScored(90, ['a'])],
      most_stylish: [],
      wardrobe_champion: [mkScored(70, ['b'])],
    };
    expect(() => diversityEngine.selectDiverse(ranked, CATEGORIES, {})).not.toThrow();
    const selected = diversityEngine.selectDiverse(ranked, CATEGORIES, {});
    expect(selected.find(s => s.catMeta.key === 'most_stylish')).toBeUndefined();
    expect(selected.length).toBe(2);
  });

  test('penalizes (but does not outright forbid) candidates that overlap heavily with recently-recommended items', () => {
    const recentlyRecommendedItemIds = new Set(['shirt', 'jeans']);
    const ranked = {
      best_match: [
        mkScored(90, ['shirt', 'jeans']),   // fully overlaps recent history
        mkScored(89, ['blouse', 'skirt']),  // fresh, nearly as good
      ],
      most_stylish: [mkScored(80, ['x'])],
      wardrobe_champion: [mkScored(70, ['y'])],
    };
    const selected = diversityEngine.selectDiverse(ranked, CATEGORIES, { recentlyRecommendedItemIds });
    const bestMatch = selected.find(s => s.catMeta.key === 'best_match');
    // The fresh alternative should win once the recency penalty is applied,
    // even though its raw confidence was slightly lower.
    expect(bestMatch.scored.confidence).toBe(89);
  });
});

describe('diversityEngine.selectDiverse — near-tie randomization', () => {
  const ranked = {
    best_match: [
      mkScored(95, ['a']), mkScored(94, ['b']), mkScored(93, ['c']), mkScored(60, ['d']),
    ],
    most_stylish: [],
    wardrobe_champion: [],
  };

  test('never selects a candidate far outside the near-tie band, regardless of rng value', () => {
    for (const rngVal of [0, 0.25, 0.5, 0.75, 0.999]) {
      const selected = diversityEngine.selectDiverse(ranked, CATEGORIES, { rng: () => rngVal });
      const pick = selected.find(s => s.catMeta.key === 'best_match');
      expect(pick.scored.confidence).not.toBe(60);
    }
  });

  test('different rng values can select different near-tied candidates', () => {
    const confidences = new Set();
    for (const rngVal of [0.01, 0.5, 0.99]) {
      const selected = diversityEngine.selectDiverse(ranked, CATEGORIES, { rng: () => rngVal });
      confidences.add(selected.find(s => s.catMeta.key === 'best_match').scored.confidence);
    }
    expect(confidences.size).toBeGreaterThan(1);
  });

  test('a single clear leader (outside tolerance of everything else) is always chosen deterministically', () => {
    const clearLeader = {
      best_match: [mkScored(95, ['a']), mkScored(50, ['b']), mkScored(40, ['c'])],
      most_stylish: [],
      wardrobe_champion: [],
    };
    for (const rngVal of [0, 0.5, 0.99]) {
      const selected = diversityEngine.selectDiverse(clearLeader, CATEGORIES, { rng: () => rngVal });
      expect(selected.find(s => s.catMeta.key === 'best_match').scored.confidence).toBe(95);
    }
  });
});

describe('diversityEngine.selectDiverse — epsilon-greedy exploration', () => {
  const originalEnv = process.env.EXPLORATION_EPSILON;
  afterEach(() => {
    if (originalEnv === undefined) delete process.env.EXPLORATION_EPSILON;
    else process.env.EXPLORATION_EPSILON = originalEnv;
    jest.resetModules();
  });

  test('never selects a candidate below the quality floor, even when exploration always fires', () => {
    process.env.EXPLORATION_EPSILON = '1'; // force exploration on every call
    jest.resetModules();
    const de = require('../../services/diversityEngine');
    const ranked = {
      best_match: [mkScored(95, ['a']), mkScored(90, ['b']), mkScored(20, ['c'])], // 20 is far below the 70% floor
      most_stylish: [], wardrobe_champion: [],
    };
    for (let i = 0; i < 20; i++) {
      const selected = de.selectDiverse(ranked, CATEGORIES, { rng: Math.random });
      const pick = selected.find(s => s.catMeta.key === 'best_match');
      expect(pick.scored.confidence).not.toBe(20);
    }
  });

  test('with exploration forced on, favors the candidate least represented in recent history over the raw top scorer', () => {
    process.env.EXPLORATION_EPSILON = '1';
    jest.resetModules();
    const de = require('../../services/diversityEngine');
    const recentlyRecommendedItemIds = new Set(['a']); // the top scorer's own item was just shown
    const ranked = {
      best_match: [mkScored(95, ['a']), mkScored(93, ['b'])], // both within the quality floor of each other
      most_stylish: [], wardrobe_champion: [],
    };
    const selected = de.selectDiverse(ranked, CATEGORIES, { rng: () => 0.5, recentlyRecommendedItemIds });
    const pick = selected.find(s => s.catMeta.key === 'best_match');
    expect(pick.scored.candidate.sourceItemIds).toEqual(['b']); // the fresher one, not the recently-shown top scorer
  });

  test('with exploration forced off (epsilon=0), behaves identically to the pre-exploration selection logic', () => {
    process.env.EXPLORATION_EPSILON = '0';
    jest.resetModules();
    const de = require('../../services/diversityEngine');
    const ranked = {
      best_match: [mkScored(95, ['a']), mkScored(94, ['b']), mkScored(93, ['c']), mkScored(60, ['d'])],
      most_stylish: [], wardrobe_champion: [],
    };
    const selected = de.selectDiverse(ranked, CATEGORIES, { rng: () => 0.01 });
    const pick = selected.find(s => s.catMeta.key === 'best_match');
    expect(pick.scored.confidence).toBe(95); // same result as the existing near-tie weighted-pick test for this rng value
  });
});

describe('diversityEngine.selectDiverse — cross-session fingerprint freshness', () => {
  test('excludes a candidate whose fingerprint was recently served, when a fresh alternative exists', () => {
    const shirtSlots  = { top: { name: 'Shirt' } };
    const blouseSlots = { top: { name: 'Blouse' } };
    const ranked = {
      best_match: [
        mkScored(90, ['a'], [], shirtSlots),
        mkScored(90, ['b'], [], blouseSlots),
      ],
      most_stylish: [],
      wardrobe_champion: [],
    };
    const recentlyServedFingerprints = new Set([scoring.fingerprintOutfit(shirtSlots)]);
    const selected = diversityEngine.selectDiverse(ranked, CATEGORIES, { recentlyServedFingerprints });
    const pick = selected.find(s => s.catMeta.key === 'best_match');
    expect(pick.scored.candidate.slots.top.name).toBe('Blouse');
  });

  test('falls back to the full pool (rather than dropping the category) when everything is recently served', () => {
    const shirtSlots  = { top: { name: 'Shirt' } };
    const blouseSlots = { top: { name: 'Blouse' } };
    const ranked = {
      best_match: [
        mkScored(90, ['a'], [], shirtSlots),
        mkScored(85, ['b'], [], blouseSlots),
      ],
      most_stylish: [],
      wardrobe_champion: [],
    };
    const recentlyServedFingerprints = new Set([
      scoring.fingerprintOutfit(shirtSlots),
      scoring.fingerprintOutfit(blouseSlots),
    ]);
    const selected = diversityEngine.selectDiverse(ranked, CATEGORIES, { recentlyServedFingerprints });
    expect(selected.find(s => s.catMeta.key === 'best_match')).toBeDefined();
  });
});
