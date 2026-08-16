'use strict';

jest.mock('../../services/aiProviderService');

const explanationService = require('../../services/explanationService');
const aiProvider          = require('../../services/aiProviderService');

function mkScored(overrides = {}) {
  return {
    subScores: {
      styleMatch: 0.8, colorHarmony: 0.8, colorPref: 0.8, occasionFit: 0.8,
      weatherFit: 0.8, behaviorSignal: 0.8, bodyTypeMatch: 0.8, fabricMatch: 0.8,
      trendScore: 0.8, comfortMatch: 0.8,
    },
    breakdown: {
      'Style Match': 80, 'Color Harmony': 80, 'Color Preference': 80,
      'Occasion Fit': 80, 'Weather Fit': 80, 'Behavior Match': 80,
    },
    outfitItems: [{ name: 'a' }, { name: 'b' }],
    candidate: { needsSuggestion: [] },
    confidence: 82,
    ...overrides,
  };
}

const sampleUser = { stylePreferences: ['classic'], fashionStyles: ['minimalist'] };

function mkSelected(overrides = {}) {
  return [{
    catMeta: { key: 'best_match', label: 'Best Match' },
    scored: mkScored(overrides.scoredOverrides),
    rank: 1,
    ...overrides,
  }];
}

beforeEach(() => {
  aiProvider.getActiveProvider.mockReset().mockReturnValue(null);
  aiProvider.generateText.mockReset();
});

describe('explanationService.buildTemplateExplanation', () => {
  test('returns all 8 explanation fields as strings', () => {
    const exp = explanationService.buildTemplateExplanation(mkScored(), 'best_match', sampleUser, { occasion: 'office', weather: { temp: 20 } });
    for (const field of ['summary', 'styleReason', 'colorReason', 'occasionReason', 'weatherReason', 'behaviorReason', 'wardrobeReason', 'calendarReason']) {
      expect(typeof exp[field]).toBe('string');
    }
  });

  test('styleReason credits named style preferences when the style score is high', () => {
    const exp = explanationService.buildTemplateExplanation(
      mkScored({ breakdown: { ...mkScored().breakdown, 'Style Match': 90 } }),
      'best_match', sampleUser, { occasion: 'office' }
    );
    expect(exp.styleReason).toContain('classic');
    expect(exp.styleReason).toContain('90/100');
  });

  test('styleReason frames a low style score as a stretch, not a mismatch', () => {
    const exp = explanationService.buildTemplateExplanation(
      mkScored({ breakdown: { ...mkScored().breakdown, 'Style Match': 40 } }),
      'best_match', sampleUser, { occasion: 'office' }
    );
    expect(exp.styleReason).toMatch(/mix things up/i);
    expect(exp.styleReason).not.toContain('classic');
  });

  test.each([
    [95, /striking, well-balanced/],
    [80, /clean, coordinated/],
    [65, /workable/],
    [50, /unconventional but wearable/],
    [20, /bold, high-contrast/],
  ])('colorReason uses the correct harmony label for a %i harmony score', (score, expectedPattern) => {
    const exp = explanationService.buildTemplateExplanation(
      mkScored({ breakdown: { ...mkScored().breakdown, 'Color Harmony': score } }),
      'best_match', sampleUser, { occasion: 'office' }
    );
    expect(exp.colorReason).toMatch(expectedPattern);
  });

  test('weatherReason cites the live temperature when weather data is present', () => {
    const exp = explanationService.buildTemplateExplanation(mkScored(), 'best_match', sampleUser, { occasion: 'office', weather: { temp: 18, condition: 'cloudy' } });
    expect(exp.weatherReason).toContain('18°C');
    expect(exp.weatherReason).toContain('cloudy');
  });

  test('weatherReason falls back to seasonal averages when live weather is unavailable', () => {
    const exp = explanationService.buildTemplateExplanation(mkScored(), 'best_match', sampleUser, { occasion: 'office', weather: null });
    expect(exp.weatherReason).toMatch(/seasonal averages/i);
  });

  test('behaviorReason cites top colors when the user has real history', () => {
    const exp = explanationService.buildTemplateExplanation(
      mkScored(), 'best_match', sampleUser,
      { occasion: 'office', insights: { hasHistory: true, topColors: ['navy', 'white'] } }
    );
    expect(exp.behaviorReason).toContain('navy');
  });

  test('behaviorReason explains the cold-start case when there is no history', () => {
    const exp = explanationService.buildTemplateExplanation(
      mkScored(), 'best_match', sampleUser, { occasion: 'office', insights: { hasHistory: false } }
    );
    expect(exp.behaviorReason).toMatch(/don't have much interaction history/i);
  });

  test('wardrobeReason reports 100% owned when there are no suggestion gaps', () => {
    const exp = explanationService.buildTemplateExplanation(
      mkScored({ outfitItems: [{ name: 'a' }, { name: 'b' }, { name: 'c' }], candidate: { needsSuggestion: [] } }),
      'best_match', sampleUser, { occasion: 'office' }
    );
    expect(exp.wardrobeReason).toMatch(/All 3 pieces/);
    expect(exp.wardrobeReason).not.toMatch(/slot/);
  });

  test('wardrobeReason reports the gap count with correct singular/plural when suggestions fill slots', () => {
    const exp = explanationService.buildTemplateExplanation(
      mkScored({ outfitItems: [{ name: 'a' }], candidate: { needsSuggestion: ['footwear'] } }),
      'best_match', sampleUser, { occasion: 'office' }
    );
    expect(exp.wardrobeReason).toContain('1 piece');
    expect(exp.wardrobeReason).toContain('1 slot was');
  });

  test('calendarReason is empty when there is no upcoming event', () => {
    const exp = explanationService.buildTemplateExplanation(mkScored(), 'best_match', sampleUser, { occasion: 'office' });
    expect(exp.calendarReason).toBe('');
  });

  test('calendarReason mentions the upcoming event and how far away it is', () => {
    const exp = explanationService.buildTemplateExplanation(
      mkScored(), 'best_match', sampleUser,
      { occasion: 'office', upcomingEvent: { occasion: 'Dashain', hoursAway: 12 } }
    );
    expect(exp.calendarReason).toContain('Dashain');
    expect(exp.calendarReason).toContain('12h');
  });
});

describe('explanationService.explainSession', () => {
  test('uses the template explanation untouched when no AI provider is configured', async () => {
    const selected = mkSelected();
    const result = await explanationService.explainSession(selected, sampleUser, { occasion: 'office' });
    expect(result[0].explanationSource).toBe('template');
    expect(result[0].explanation).toEqual(result[0].templateExplanation);
    expect(aiProvider.generateText).not.toHaveBeenCalled();
  });

  test('uses the LLM-polished explanation when the provider returns a valid, well-shaped response', async () => {
    aiProvider.getActiveProvider.mockReturnValue('gemini');
    aiProvider.generateText.mockResolvedValue(JSON.stringify({
      explanations: [{
        index: 0, category: 'Best Match', confidence: 82,
        summary: 'polished summary', styleReason: 'polished style', colorReason: 'polished color',
        occasionReason: 'polished occasion', weatherReason: 'polished weather',
        behaviorReason: 'polished behavior', wardrobeReason: 'polished wardrobe', calendarReason: '',
      }],
    }));

    const result = await explanationService.explainSession(mkSelected(), sampleUser, { occasion: 'office' });
    expect(result[0].explanationSource).toBe('llm_polished');
    expect(result[0].explanation.summary).toBe('polished summary');
    // index/category/confidence must be stripped from the persisted explanation object.
    expect(result[0].explanation.index).toBeUndefined();
    expect(result[0].explanation.category).toBeUndefined();
  });

  test('falls back to the template when the LLM response is not valid JSON', async () => {
    aiProvider.getActiveProvider.mockReturnValue('gemini');
    aiProvider.generateText.mockResolvedValue('not json at all');

    const result = await explanationService.explainSession(mkSelected(), sampleUser, { occasion: 'office' });
    expect(result[0].explanationSource).toBe('template');
    expect(result[0].explanation).toEqual(result[0].templateExplanation);
  });

  test('repairs a trailing comma in an otherwise-valid JSON response', async () => {
    aiProvider.getActiveProvider.mockReturnValue('gemini');
    aiProvider.generateText.mockResolvedValue(`{"explanations": [{"index": 0, "category": "Best Match", "confidence": 82, "summary": "s", "styleReason": "st", "colorReason": "c", "occasionReason": "o", "weatherReason": "w", "behaviorReason": "b", "wardrobeReason": "wd", "calendarReason": "",}]}`);

    const result = await explanationService.explainSession(mkSelected(), sampleUser, { occasion: 'office' });
    expect(result[0].explanationSource).toBe('llm_polished');
    expect(result[0].explanation.summary).toBe('s');
  });

  test('falls back to the template for one entry whose polished shape is missing a required field, without affecting a valid sibling entry', async () => {
    aiProvider.getActiveProvider.mockReturnValue('gemini');
    const selected = [
      { catMeta: { key: 'best_match', label: 'Best Match' }, scored: mkScored(), rank: 1 },
      { catMeta: { key: 'most_stylish', label: 'Most Stylish' }, scored: mkScored(), rank: 2 },
    ];
    aiProvider.generateText.mockResolvedValue(JSON.stringify({
      explanations: [
        { index: 0, summary: 'ok', styleReason: 'ok', colorReason: 'ok', occasionReason: 'ok', weatherReason: 'ok', behaviorReason: 'ok', wardrobeReason: 'ok', calendarReason: '' },
        { index: 1, summary: 'missing fields' }, // invalid shape — several required fields absent
      ],
    }));

    const result = await explanationService.explainSession(selected, sampleUser, { occasion: 'office' });
    expect(result[0].explanationSource).toBe('llm_polished');
    expect(result[1].explanationSource).toBe('template');
  });

  test('falls back to the template for every entry when the LLM call itself rejects', async () => {
    aiProvider.getActiveProvider.mockReturnValue('gemini');
    aiProvider.generateText.mockRejectedValue(new Error('provider down'));

    const result = await explanationService.explainSession(mkSelected(), sampleUser, { occasion: 'office' });
    expect(result[0].explanationSource).toBe('template');
  });
});
