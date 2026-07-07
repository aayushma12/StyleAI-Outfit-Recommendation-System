'use strict';

const { rocAuc, toLiveScores, sessionDiversity, jaccard } = require('../../scripts/evaluateHybridVsRuleOnly');

describe('evaluateHybridVsRuleOnly.rocAuc', () => {
  test('returns 1.0 for a perfect discriminator (all positives score higher than all negatives)', () => {
    const scores = [0.9, 0.8, 0.2, 0.1];
    const labels = [1, 1, 0, 0];
    expect(rocAuc(scores, labels)).toBeCloseTo(1.0, 4);
  });

  test('returns 0.0 for a perfectly inverted discriminator', () => {
    const scores = [0.1, 0.2, 0.8, 0.9];
    const labels = [1, 1, 0, 0];
    expect(rocAuc(scores, labels)).toBeCloseTo(0.0, 4);
  });

  test('returns ~0.5 for a discriminator with no real signal (random-order scores)', () => {
    const scores = [0.5, 0.5, 0.5, 0.5];
    const labels = [1, 0, 1, 0];
    expect(rocAuc(scores, labels)).toBeCloseTo(0.5, 4);
  });

  test('returns null when every label is the same class (AUC undefined)', () => {
    expect(rocAuc([0.9, 0.1], [1, 1])).toBeNull();
    expect(rocAuc([0.9, 0.1], [0, 0])).toBeNull();
  });

  test('handles tied scores via average-rank without throwing', () => {
    const scores = [0.5, 0.5, 0.5, 0.5];
    const labels = [1, 0, 0, 1];
    expect(() => rocAuc(scores, labels)).not.toThrow();
    expect(rocAuc(scores, labels)).toBeCloseTo(0.5, 4);
  });
});

describe('evaluateHybridVsRuleOnly.toLiveScores', () => {
  test('maps the stored colorPreference field to the live colorPref key (the documented naming difference)', () => {
    const live = toLiveScores({ colorPreference: 80, styleMatch: 70 });
    expect(live.colorPref).toBeCloseTo(0.8);
    expect(live.colorPreference).toBeUndefined();
  });

  test('defaults a missing dimension to a neutral 0.7 (70/100) rather than 0', () => {
    const live = toLiveScores({});
    expect(live.styleMatch).toBeCloseTo(0.7);
  });
});

describe('evaluateHybridVsRuleOnly.sessionDiversity', () => {
  test('returns null for a session with fewer than 2 recommendations', () => {
    expect(sessionDiversity([{ outfit: { top: { item: 'a' } } }])).toBeNull();
    expect(sessionDiversity([])).toBeNull();
  });

  test('returns 1.0 (fully diverse) when no two recs share any item', () => {
    const recs = [
      { outfit: { top: { item: 'a' } } },
      { outfit: { top: { item: 'b' } } },
    ];
    expect(sessionDiversity(recs)).toBe(1);
  });

  test('returns 0.0 (no diversity) when two recs use the exact same items', () => {
    const recs = [
      { outfit: { top: { item: 'a' }, bottom: { item: 'b' } } },
      { outfit: { top: { item: 'a' }, bottom: { item: 'b' } } },
    ];
    expect(sessionDiversity(recs)).toBe(0);
  });
});

describe('evaluateHybridVsRuleOnly.jaccard', () => {
  test('both empty sets return 0 (matches diversityEngine.js\'s documented edge case)', () => {
    expect(jaccard([], [])).toBe(0);
  });

  test('identical sets return 1', () => {
    expect(jaccard(['a', 'b'], ['a', 'b'])).toBe(1);
  });

  test('disjoint sets return 0', () => {
    expect(jaccard(['a'], ['b'])).toBe(0);
  });
});
