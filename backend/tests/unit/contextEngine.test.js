'use strict';

jest.mock('../../models/WardrobeItem');
jest.mock('../../models/WardrobeCombo');
jest.mock('../../models/OutfitCalendar');
jest.mock('../../models/Recommendation');
jest.mock('../../models/Outfit');
jest.mock('../../services/behaviorService');
jest.mock('../../services/kathmanduIntelligence');
jest.mock('../../services/collaborativeService');
jest.mock('../../services/weatherService');
jest.mock('../../services/personalizedLearningService');

const contextEngine  = require('../../services/contextEngine');
const WardrobeItem   = require('../../models/WardrobeItem');
const WardrobeCombo  = require('../../models/WardrobeCombo');
const OutfitCalendar = require('../../models/OutfitCalendar');
const Recommendation = require('../../models/Recommendation');
const Outfit         = require('../../models/Outfit');
const behaviorService = require('../../services/behaviorService');
const kathmandu        = require('../../services/kathmanduIntelligence');
const collaborative    = require('../../services/collaborativeService');
const weatherService   = require('../../services/weatherService');
const personalizedLearningService = require('../../services/personalizedLearningService');

// ── Chainable Mongoose-query mock helper — .find().sort().limit().select().lean() ──
function mkQuery(resolvedValue) {
  const q = {
    sort:   jest.fn(() => q),
    limit:  jest.fn(() => q),
    select: jest.fn(() => q),
    lean:   jest.fn(() => Promise.resolve(resolvedValue)),
    catch:  (fn) => Promise.resolve(resolvedValue).catch(fn),
    then:   (res, rej) => Promise.resolve(resolvedValue).then(res, rej),
  };
  return q;
}

const sampleUser = { _id: 'user1', occasionPreferences: [] };

beforeEach(() => {
  WardrobeItem.find.mockReset().mockReturnValue(mkQuery([
    { _id: 'i1', category: 'tops', name: 'Blouse' },
    { _id: 'i2', category: 'bottoms', name: 'Jeans' },
  ]));
  WardrobeCombo.find.mockReset().mockReturnValue(mkQuery([]));
  OutfitCalendar.find.mockReset().mockReturnValue(mkQuery([]));
  Recommendation.find.mockReset().mockReturnValue(mkQuery([]));
  Outfit.find.mockReset().mockReturnValue(mkQuery([]));

  behaviorService.getUserInsights.mockReset().mockResolvedValue({ hasHistory: false });
  behaviorService.getNegativeSignals.mockReset().mockResolvedValue({});
  behaviorService.getStyleEvolution.mockReset().mockResolvedValue({});
  behaviorService.getRecentlyRecommendedItemIds.mockReset().mockResolvedValue([]);

  kathmandu.getSeasonIntelligence.mockReset().mockReturnValue({ name: 'autumn' });
  kathmandu.getActiveFestivals.mockReset().mockReturnValue({ current: [] });
  kathmandu.requiresTraditionalConsideration.mockReset().mockReturnValue(false);

  collaborative.getCollaborativeData.mockReset().mockResolvedValue({});
  collaborative.refreshSimilarUsers.mockReset().mockResolvedValue();

  weatherService.fetchWeather.mockReset().mockResolvedValue({ temp: 22, condition: 'clear' });

  personalizedLearningService.generateWardrobeUtilizationReport.mockReset().mockResolvedValue({ underusedItems: [] });
  personalizedLearningService.getPredictiveInsights.mockReset().mockResolvedValue([]);
});

describe('contextEngine.buildContext', () => {
  test('defaults occasion to "daily" and wardrobeOnly to false when omitted', async () => {
    const ctx = await contextEngine.buildContext(sampleUser, {});
    expect(ctx.occasion).toBe('daily');
    expect(ctx.wardrobeOnly).toBe(false);
  });

  test('groups fetched wardrobe items by category', async () => {
    const ctx = await contextEngine.buildContext(sampleUser, {});
    expect(Object.keys(ctx.grouped).sort()).toEqual(['bottoms', 'tops']);
    expect(ctx.grouped.tops).toHaveLength(1);
  });

  test('allowSuggestions defaults to the inverse of wardrobeOnly', async () => {
    const withWardrobeOnly = await contextEngine.buildContext(sampleUser, { wardrobeOnly: true });
    expect(withWardrobeOnly.allowSuggestions).toBe(false);

    const without = await contextEngine.buildContext(sampleUser, { wardrobeOnly: false });
    expect(without.allowSuggestions).toBe(true);
  });

  test('an explicit allowSuggestions override wins over the wardrobeOnly-derived default', async () => {
    const ctx = await contextEngine.buildContext(sampleUser, { wardrobeOnly: true, allowSuggestions: true });
    expect(ctx.allowSuggestions).toBe(true);
  });

  test('cfInsights is null when the collaborative signal has no shared styles', async () => {
    collaborative.getCollaborativeData.mockResolvedValue({ sharedStyles: [] });
    const ctx = await contextEngine.buildContext(sampleUser, {});
    expect(ctx.cfInsights).toBeNull();
  });

  test('cfInsights carries the collaborative data when shared styles exist', async () => {
    const cfData = { sharedStyles: ['minimalist'], signal: 0.6 };
    collaborative.getCollaborativeData.mockResolvedValue(cfData);
    const ctx = await contextEngine.buildContext(sampleUser, {});
    expect(ctx.cfInsights).toEqual(cfData);
  });

  test('styleHint is "traditional" only when kathmanduIntelligence says the occasion requires it', async () => {
    kathmandu.requiresTraditionalConsideration.mockReturnValue(true);
    const ctx = await contextEngine.buildContext(sampleUser, { occasion: 'wedding' });
    expect(ctx.styleHint).toBe('traditional');
    expect(kathmandu.requiresTraditionalConsideration).toHaveBeenCalledWith('wedding');
  });

  test('a provided upcomingEvent/recentOutfitSummaries short-circuits the DB lookups for them', async () => {
    const providedEvent = { title: 'Dashain', hoursAway: 5 };
    const providedSummaries = ['already computed'];
    const ctx = await contextEngine.buildContext(sampleUser, {
      upcomingEvent: providedEvent, recentOutfitSummaries: providedSummaries,
    });
    expect(ctx.upcomingEvent).toEqual(providedEvent);
    expect(ctx.recentOutfitSummaries).toEqual(providedSummaries);
    expect(OutfitCalendar.find).not.toHaveBeenCalled();
  });

  test('a rejected optional signal (negative signals) degrades to {} rather than failing the whole context build', async () => {
    behaviorService.getNegativeSignals.mockRejectedValue(new Error('down'));
    const ctx = await contextEngine.buildContext(sampleUser, {});
    expect(ctx.negativeSignals).toEqual({});
  });

  test('a rejected collaborative-data call degrades to {} rather than failing the whole context build', async () => {
    collaborative.getCollaborativeData.mockRejectedValue(new Error('down'));
    const ctx = await contextEngine.buildContext(sampleUser, {});
    expect(ctx.cfData).toEqual({});
    expect(ctx.cfInsights).toBeNull();
  });
});

describe('contextEngine pure helpers', () => {
  test('groupByCategory buckets items by their category field, defaulting to "other"', () => {
    const grouped = contextEngine.groupByCategory([
      { category: 'tops', name: 'a' },
      { category: 'tops', name: 'b' },
      { name: 'no category' },
    ]);
    expect(grouped.tops).toHaveLength(2);
    expect(grouped.other).toHaveLength(1);
  });

  test('getTimeOfDay returns one of the four known buckets', () => {
    expect(['morning', 'afternoon', 'evening', 'night']).toContain(contextEngine.getTimeOfDay());
  });

  test('getTimeOfDayNote returns a non-empty string for every known time-of-day bucket', () => {
    for (const tod of ['morning', 'afternoon', 'evening', 'night']) {
      expect(contextEngine.getTimeOfDayNote(tod)).toEqual(expect.any(String));
      expect(contextEngine.getTimeOfDayNote(tod).length).toBeGreaterThan(0);
    }
  });

  test('getTimeOfDayNote returns an empty string for an unknown bucket, not a crash', () => {
    expect(contextEngine.getTimeOfDayNote('not-a-real-bucket')).toBe('');
  });

  test('buildProfileSection includes only the profile fields that are actually set', () => {
    const section = contextEngine.buildProfileSection({ age: 22, bodyType: 'hourglass' });
    expect(section).toContain('Age: 22');
    expect(section).toContain('Body type: hourglass');
    expect(section).not.toContain('Occupation');
  });

  test('buildProfileSection falls back to a generic note for a fully empty profile', () => {
    const section = contextEngine.buildProfileSection({});
    expect(section).toMatch(/general fashion principles/i);
  });

  test('buildProfileSection explicitly flags disliked colors as NEVER include', () => {
    const section = contextEngine.buildProfileSection({ dislikedColors: ['orange'] });
    expect(section).toMatch(/NEVER include/);
    expect(section).toContain('orange');
  });
});
