'use strict';

jest.mock('../../models/Recommendation');
jest.mock('../../services/contextEngine');
jest.mock('../../services/candidateGenerationService');
jest.mock('../../services/rankingService');
jest.mock('../../services/diversityEngine');
jest.mock('../../services/explanationService');
jest.mock('../../services/weatherService');

const recommendationEngine       = require('../../services/recommendationEngine');
const Recommendation             = require('../../models/Recommendation');
const contextEngine              = require('../../services/contextEngine');
const candidateGenerationService = require('../../services/candidateGenerationService');
const rankingService             = require('../../services/rankingService');
const diversityEngine            = require('../../services/diversityEngine');
const explanationService         = require('../../services/explanationService');

const sampleUser = { _id: 'user1' };

const SUB_SCORES = {
  styleMatch: 0.8, colorHarmony: 0.8, colorPref: 0.8, occasionFit: 0.8,
  weatherFit: 0.8, behaviorSignal: 0.8, bodyTypeMatch: 0.8, fabricMatch: 0.8,
  trendScore: 0.8, comfortMatch: 0.8,
};
const BREAKDOWN = {
  'Style Match': 80, 'Color Harmony': 80, 'Color Preference': 80, 'Occasion Fit': 80,
  'Weather Fit': 80, 'Behavior Match': 80, 'Body Type Match': 80, 'Fabric Match': 80,
  'Trend Score': 80, 'Comfort Match': 80,
};
const EXPLANATION = {
  summary: 'summary', styleReason: 'style', colorReason: 'color', occasionReason: 'occasion',
  weatherReason: 'weather', behaviorReason: 'behavior', wardrobeReason: 'wardrobe', calendarReason: '',
};

function mkCandidate(id, itemIds, needsSuggestion = []) {
  const slots = {};
  const names = ['top', 'bottom'];
  itemIds.forEach((it, i) => { slots[names[i]] = { item: it, name: it }; });
  return { id, slots, needsSuggestion, sourceItemIds: itemIds };
}

function mkChainable(resolvedValue) {
  const q = {
    sort:  jest.fn(() => q),
    skip:  jest.fn(() => q),
    limit: jest.fn(() => q),
    lean:  jest.fn(() => Promise.resolve(resolvedValue)),
  };
  return q;
}

function baseContext(overrides = {}) {
  return {
    wardrobeItems: [], occasion: 'office', mood: '', wardrobeOnly: false, requestedBy: 'user',
    tod: 'morning', styleHint: '', allowSuggestions: true, catalogItems: [],
    weather: { temp: 20, condition: 'clear' },
    season: { season: 'autumn', seasonKey: 'autumn', climate: 'mild' },
    festivals: { current: [], primaryFestival: null },
    insights: {
      hasHistory: false, topColors: [], topCategories: [], topOccasions: [],
      recommendationStats: { acceptRate: 50 }, totalInteractions: 3,
    },
    cfData: { peerCount: 0, sharedStyles: [], sharedOccasions: [], signal: null },
    upcomingEvent: null,
    ...overrides,
  };
}

beforeEach(() => {
  contextEngine.buildContext.mockReset().mockImplementation(async () => baseContext());
  contextEngine.getUpcomingCalendarEvent = jest.fn();
  contextEngine.getRecentOutfitSummaries = jest.fn();

  // 5 distinct candidates (distinct item ids) so that, once diversityEngine
  // picks one per category, every one of the 5 standard categories ends up
  // with a genuinely distinct outfit fingerprint — otherwise
  // scoring.deduplicateRecommendations (real, not mocked) correctly collapses
  // same-outfit categories down, which would make these fixtures produce
  // fewer than 5 recommendations for a reason that has nothing to do with
  // what each test is actually checking.
  candidateGenerationService.generateCandidates.mockReset().mockReturnValue([
    mkCandidate('c1', ['i1', 'i2']),
    mkCandidate('c2', ['i3', 'i4']),
    mkCandidate('c3', ['i5', 'i6']),
    mkCandidate('c4', ['i7', 'i8']),
    mkCandidate('c5', ['i9', 'i10']),
  ]);

  rankingService.rankForCategories.mockReset().mockImplementation(async (candidates, user, context, categories) => {
    const perCat = {};
    categories.forEach(catMeta => {
      perCat[catMeta.key] = candidates.map((candidate, i) => ({
        candidate,
        outfitItems: [{ name: 'Navy Blouse', category: 'tops' }, { name: 'Black Jeans', category: 'bottoms' }],
        subScores: SUB_SCORES,
        mlAcceptanceProbability: null,
        datasetCompatProbability: null,
        confidence: 90 - i * 10,
        breakdown: BREAKDOWN,
        ruleScore: 0.8,
      }));
    });
    return perCat;
  });

  // Picks a different-index candidate per category (wrapping if the pool is
  // smaller than the category count) so distinct categories get distinct
  // outfits, same as the real diversityEngine's purpose.
  diversityEngine.selectDiverse.mockReset().mockImplementation((rankedPerCategory, categories) =>
    categories.map((catMeta, i) => {
      const pool = rankedPerCategory[catMeta.key];
      return { catMeta, scored: pool[i % pool.length], rank: 1 };
    })
  );

  explanationService.explainSession.mockReset().mockImplementation(async (selected) =>
    selected.map(s => ({ ...s, explanation: EXPLANATION, explanationSource: 'template' }))
  );
  explanationService.buildTemplateExplanation = jest.fn(() => EXPLANATION);

  Recommendation.create.mockReset().mockResolvedValue({ _id: 'sess1' });
  Recommendation.findById.mockReset().mockReturnValue({});
  Recommendation.findOne.mockReset().mockReturnValue(mkChainable(null));
  Recommendation.find.mockReset().mockReturnValue(mkChainable([]));
  Recommendation.countDocuments.mockReset().mockResolvedValue(0);
  Recommendation.populateAndSanitize.mockReset().mockResolvedValue({ _id: 'sess1', recommendations: [] });
});

describe('recommendationEngine.generateSession', () => {
  test('runs the full pipeline in order: context -> candidates -> ranking -> diversity -> explanation', async () => {
    await recommendationEngine.generateSession(sampleUser, { occasion: 'office' });
    expect(contextEngine.buildContext).toHaveBeenCalledWith(sampleUser, expect.objectContaining({ occasion: 'office' }));
    expect(candidateGenerationService.generateCandidates).toHaveBeenCalled();
    expect(rankingService.rankForCategories).toHaveBeenCalled();
    expect(diversityEngine.selectDiverse).toHaveBeenCalled();
    expect(explanationService.explainSession).toHaveBeenCalled();
  });

  test('creates a Recommendation with 5 standard categories, one per RECOMMENDATION_CATEGORIES entry', async () => {
    await recommendationEngine.generateSession(sampleUser, { occasion: 'office' });
    const created = Recommendation.create.mock.calls[0][0];
    expect(created.recommendations).toHaveLength(5);
    expect(created.recommendations.map(r => r.category).sort()).toEqual(
      ['best_match', 'most_stylish', 'most_comfortable', 'weather_optimized', 'wardrobe_champion'].sort()
    );
    expect(created.generationMeta.pipelineVersion).toBe('v2');
    expect(created.status).toBe('complete');
  });

  test('omits weather from the stored context when live weather is unavailable (temp null)', async () => {
    contextEngine.buildContext.mockResolvedValue(baseContext({ weather: { temp: null } }));
    await recommendationEngine.generateSession(sampleUser, { occasion: 'office' });
    const created = Recommendation.create.mock.calls[0][0];
    expect(created.context.weather).toBeUndefined();
  });

  test('includes weather in the stored context when live weather is available', async () => {
    await recommendationEngine.generateSession(sampleUser, { occasion: 'office' });
    const created = Recommendation.create.mock.calls[0][0];
    expect(created.context.weather).toEqual({ temp: 20, condition: 'clear' });
  });

  test('each ranked recommendation carries mlAcceptanceProbability and datasetCompatProbability through from the scored candidate', async () => {
    rankingService.rankForCategories.mockImplementation(async (candidates, user, context, categories) => {
      const perCat = {};
      categories.forEach(catMeta => {
        perCat[catMeta.key] = [{
          candidate: candidates[0],
          outfitItems: [{ name: 'Navy Blouse', category: 'tops' }],
          subScores: SUB_SCORES, breakdown: BREAKDOWN, ruleScore: 0.8,
          mlAcceptanceProbability: 0.42, datasetCompatProbability: 0.55,
        }];
      });
      return perCat;
    });
    await recommendationEngine.generateSession(sampleUser, { occasion: 'office' });
    const created = Recommendation.create.mock.calls[0][0];
    expect(created.recommendations[0].mlAcceptanceProbability).toBe(0.42);
    expect(created.recommendations[0].datasetCompatProbability).toBe(0.55);
  });

  test('builds an outfit name from the primary tops/dresses item, not just the first slot', async () => {
    rankingService.rankForCategories.mockImplementation(async (candidates, user, categories2) => {});
    rankingService.rankForCategories.mockImplementation(async (candidates, user, context, categories) => {
      const perCat = {};
      categories.forEach(catMeta => {
        perCat[catMeta.key] = [{
          candidate: candidates[0],
          outfitItems: [{ name: 'White Sneakers', category: 'footwear' }, { name: 'Navy Blouse', category: 'tops' }],
          subScores: SUB_SCORES, breakdown: BREAKDOWN, ruleScore: 0.8,
          mlAcceptanceProbability: null, datasetCompatProbability: null,
        }];
      });
      return perCat;
    });
    await recommendationEngine.generateSession(sampleUser, { occasion: 'office' });
    const created = Recommendation.create.mock.calls[0][0];
    expect(created.recommendations[0].outfitName).toContain('Navy Blouse');
  });

  test('caps alternates at 2 per category and excludes the exact selected candidate by fingerprint', async () => {
    rankingService.rankForCategories.mockImplementation(async (candidates, user, context, categories) => {
      const perCat = {};
      categories.forEach(catMeta => {
        perCat[catMeta.key] = candidates.map((candidate, i) => ({
          candidate,
          outfitItems: [{ name: `Item ${i}`, category: 'tops' }],
          subScores: SUB_SCORES, breakdown: BREAKDOWN, ruleScore: 0.8,
          mlAcceptanceProbability: null, datasetCompatProbability: null,
          confidence: 90 - i * 5,
        }));
      });
      return perCat;
    });
    candidateGenerationService.generateCandidates.mockReturnValue([
      mkCandidate('c1', ['i1']), mkCandidate('c2', ['i2']), mkCandidate('c3', ['i3']), mkCandidate('c4', ['i4']),
    ]);
    await recommendationEngine.generateSession(sampleUser, { occasion: 'office' });
    const created = Recommendation.create.mock.calls[0][0];
    const alternates = created.recommendations[0].alternates;
    expect(alternates.length).toBeLessThanOrEqual(2);
  });

  test('adds a festival tip when the context has an active festival', async () => {
    contextEngine.buildContext.mockResolvedValue(baseContext({
      festivals: { current: [{ name: 'Dashain', note: 'Wear red and gold.' }], primaryFestival: { name: 'Dashain' } },
    }));
    await recommendationEngine.generateSession(sampleUser, { occasion: 'office' });
    const created = Recommendation.create.mock.calls[0][0];
    expect(created.recommendations[0].tips.some(t => t.includes('Dashain'))).toBe(true);
  });

  test('stores calendarEventContext.hasEvent=false when there is no upcoming event', async () => {
    await recommendationEngine.generateSession(sampleUser, { occasion: 'office' });
    const created = Recommendation.create.mock.calls[0][0];
    expect(created.calendarEventContext).toEqual({ hasEvent: false });
  });

  test('stores calendarEventContext details when an upcoming event is present', async () => {
    contextEngine.buildContext.mockResolvedValue(baseContext({
      upcomingEvent: { occasion: 'Dashain', hoursAway: 10, date: new Date(), notes: 'family gathering' },
    }));
    await recommendationEngine.generateSession(sampleUser, { occasion: 'office' });
    const created = Recommendation.create.mock.calls[0][0];
    expect(created.calendarEventContext.hasEvent).toBe(true);
    expect(created.calendarEventContext.hoursAway).toBe(10);
  });
});

describe('recommendationEngine.generateWizardSession', () => {
  test('creates a Recommendation with the 3 wizard categories and a wizardContext', async () => {
    await recommendationEngine.generateWizardSession(sampleUser, { occasion: 'party', style: 'Casual', extraNotes: 'no heels' });
    const created = Recommendation.create.mock.calls[0][0];
    expect(created.recommendations).toHaveLength(3);
    expect(created.recommendations.map(r => r.category).sort()).toEqual(
      ['wizard_option_1', 'wizard_option_2', 'wizard_option_3'].sort()
    );
    expect(created.wizardContext).toEqual({ occasion: 'party', style: 'Casual', extraNotes: 'no heels' });
  });

  test('always allows suggestions regardless of wardrobe size, unlike a standard session', async () => {
    await recommendationEngine.generateWizardSession(sampleUser, { occasion: 'party' });
    const candidateArgs = candidateGenerationService.generateCandidates.mock.calls[0][2];
    expect(candidateArgs.allowSuggestions).toBe(true);
  });
});

describe('recommendationEngine.getHistory', () => {
  test('computes pagination fields from the total count and page size', async () => {
    Recommendation.countDocuments.mockResolvedValue(17);
    const result = await recommendationEngine.getHistory('user1', { page: 2, limit: 8 });
    expect(result.total).toBe(17);
    expect(result.page).toBe(2);
    expect(result.pages).toBe(3); // ceil(17/8)
  });
});

describe('recommendationEngine.getLatestSession', () => {
  test('queries with a 6-hour recency window and complete status', async () => {
    await recommendationEngine.getLatestSession('user1');
    const query = Recommendation.findOne.mock.calls[0][0];
    expect(query.user).toBe('user1');
    expect(query.status).toBe('complete');
    expect(query.createdAt.$gte).toBeInstanceOf(Date);
  });
});
