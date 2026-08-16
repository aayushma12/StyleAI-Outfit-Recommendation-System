'use strict';

jest.mock('../../services/mlBridgeService');

const rankingService = require('../../services/rankingService');
const mlBridge       = require('../../services/mlBridgeService');

const CATEGORIES = [
  { key: 'best_match',   label: 'Best Match' },
  { key: 'most_stylish', label: 'Most Stylish' },
];

const WARDROBE = [
  { _id: 'top1',  name: 'Navy Blouse',    category: 'tops',        color: 'navy',  occasion: 'office', formalityLevel: 2 },
  { _id: 'bot1',  name: 'Black Trousers', category: 'bottoms',     color: 'black', occasion: 'office', formalityLevel: 2 },
  { _id: 'shoe1', name: 'White Sneakers', category: 'footwear',    color: 'white', occasion: 'daily',  formalityLevel: 1 },
  { _id: 'bag1',  name: 'Tan Tote Bag',   category: 'accessories', color: 'tan',   occasion: 'daily',  formalityLevel: 1 },
];

function mkCandidate(itemIds) {
  const slots = {};
  const slotNames = ['top', 'bottom', 'footwear', 'accessory'];
  itemIds.forEach((id, i) => { slots[slotNames[i]] = { item: id, name: '' }; });
  return { slots, needsSuggestion: [], sourceItemIds: itemIds };
}

const sampleUser = {
  stylePreferences: ['classic'], fashionStyles: ['minimalist'],
  skinTone: 'medium', colorPreferences: ['navy'], dislikedColors: [],
  bodyType: 'hourglass', fabricPreferences: [],
};

function baseContext(overrides = {}) {
  return {
    wardrobeItems: WARDROBE,
    occasion: 'office',
    weather: { temp: 20 },
    insights: { hasHistory: false },
    wardrobeOnly: false,
    ...overrides,
  };
}

const AVAILABLE_NONE = { available: false, predictions: [] };

beforeEach(() => {
  mlBridge.predictAcceptance.mockReset().mockResolvedValue(AVAILABLE_NONE);
  mlBridge.predictCompat.mockReset().mockResolvedValue(AVAILABLE_NONE);
});

describe('rankingService.rankForCategories', () => {
  test('returns one sorted-descending array per requested category', async () => {
    const candidates = [mkCandidate(['top1', 'bot1']), mkCandidate(['top1', 'bot1', 'shoe1'])];
    const result = await rankingService.rankForCategories(candidates, sampleUser, baseContext(), CATEGORIES);

    expect(Object.keys(result).sort()).toEqual(['best_match', 'most_stylish'].sort());
    for (const key of Object.keys(result)) {
      const confidences = result[key].map(r => r.confidence);
      expect(confidences).toEqual([...confidences].sort((a, b) => b - a));
    }
  });

  test('resolves each candidate\'s slot item ids into full WardrobeItem docs', async () => {
    const candidates = [mkCandidate(['top1', 'bot1'])];
    const result = await rankingService.rankForCategories(candidates, sampleUser, baseContext(), CATEGORIES);
    const outfitItems = result.best_match[0].outfitItems;
    expect(outfitItems.map(i => i._id).sort()).toEqual(['bot1', 'top1'].sort());
  });

  test('mlAcceptanceProbability is null for every candidate when the acceptance model is unavailable', async () => {
    const candidates = [mkCandidate(['top1', 'bot1'])];
    const result = await rankingService.rankForCategories(candidates, sampleUser, baseContext(), CATEGORIES);
    expect(result.best_match[0].mlAcceptanceProbability).toBeNull();
  });

  test('attaches mlAcceptanceProbability from a batched predictAcceptance response, matched by index', async () => {
    mlBridge.predictAcceptance.mockResolvedValue({
      available: true,
      predictions: [{ acceptanceProbability: 0.73 }, { acceptanceProbability: 0.21 }],
    });
    const candidates = [mkCandidate(['top1', 'bot1']), mkCandidate(['shoe1', 'bag1'])];
    const result = await rankingService.rankForCategories(candidates, sampleUser, baseContext(), CATEGORIES);

    const byFingerprint = {};
    result.best_match.forEach(r => { byFingerprint[r.candidate.sourceItemIds.join(',')] = r.mlAcceptanceProbability; });
    expect(byFingerprint['top1,bot1']).toBe(0.73);
    expect(byFingerprint['shoe1,bag1']).toBe(0.21);
  });

  test('attaches datasetCompatProbability independently of mlAcceptanceProbability', async () => {
    mlBridge.predictAcceptance.mockResolvedValue(AVAILABLE_NONE); // acceptance model down
    mlBridge.predictCompat.mockResolvedValue({
      available: true,
      predictions: [{ datasetCompatProbability: 0.55 }],
    });
    const candidates = [mkCandidate(['top1', 'bot1'])];
    const result = await rankingService.rankForCategories(candidates, sampleUser, baseContext(), CATEGORIES);

    expect(result.best_match[0].mlAcceptanceProbability).toBeNull();
    expect(result.best_match[0].datasetCompatProbability).toBe(0.55);
  });

  test('a predictAcceptance rejection never blocks ranking — degrades to null, not a throw', async () => {
    mlBridge.predictAcceptance.mockRejectedValue(new Error('ML service down'));
    const candidates = [mkCandidate(['top1', 'bot1'])];
    await expect(
      rankingService.rankForCategories(candidates, sampleUser, baseContext(), CATEGORIES)
    ).resolves.toBeDefined();
  });

  test('a predictCompat rejection never blocks ranking — degrades to null, not a throw', async () => {
    mlBridge.predictCompat.mockRejectedValue(new Error('Compat service down'));
    const candidates = [mkCandidate(['top1', 'bot1'])];
    const result = await rankingService.rankForCategories(candidates, sampleUser, baseContext(), CATEGORIES);
    expect(result.best_match[0].datasetCompatProbability).toBeNull();
  });

  test('predictCompat is called with one bucket/color feature object per candidate, matching WardrobeItem.category', async () => {
    const candidates = [mkCandidate(['top1', 'bot1', 'shoe1', 'bag1'])];
    await rankingService.rankForCategories(candidates, sampleUser, baseContext(), CATEGORIES);

    expect(mlBridge.predictCompat).toHaveBeenCalledTimes(1);
    const [batch] = mlBridge.predictCompat.mock.calls[0];
    expect(batch).toHaveLength(1);
    expect(batch[0]).toMatchObject({
      numItems: 4, numTops: 1, numBottoms: 1, numFootwear: 1, numAccessories: 1, numDresses: 0,
      categoryDiversity: 4,
    });
  });

  test('both ML calls are batched exactly once per session, never per-candidate', async () => {
    const candidates = [mkCandidate(['top1', 'bot1']), mkCandidate(['shoe1', 'bag1']), mkCandidate(['top1', 'shoe1'])];
    await rankingService.rankForCategories(candidates, sampleUser, baseContext(), CATEGORIES);
    expect(mlBridge.predictAcceptance).toHaveBeenCalledTimes(1);
    expect(mlBridge.predictCompat).toHaveBeenCalledTimes(1);
    expect(mlBridge.predictAcceptance.mock.calls[0][0]).toHaveLength(3);
  });

  test('an empty candidate list resolves to an empty array per category without error', async () => {
    const result = await rankingService.rankForCategories([], sampleUser, baseContext(), CATEGORIES);
    expect(result.best_match).toEqual([]);
    expect(result.most_stylish).toEqual([]);
  });
});
