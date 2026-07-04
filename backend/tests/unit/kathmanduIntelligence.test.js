'use strict';

const ki = require('../../services/kathmanduIntelligence');
const KathmanduTrend = require('../../models/KathmanduTrend');

describe('kathmanduIntelligence — new seasonal/local-brand content', () => {
  test('KATHMANDU_SEASONAL_NOTES has exactly 12 entries with unique months 1-12', () => {
    expect(ki.KATHMANDU_SEASONAL_NOTES.length).toBe(12);
    const months = ki.KATHMANDU_SEASONAL_NOTES.map(n => n.month).sort((a, b) => a - b);
    expect(months).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  test('every seasonal note has a non-empty name and fashionNote, and a valid season enum value', () => {
    const VALID_SEASONS = ['spring', 'summer', 'monsoon', 'autumn', 'winter', 'all'];
    ki.KATHMANDU_SEASONAL_NOTES.forEach(note => {
      expect(note.name.length).toBeGreaterThan(0);
      expect(note.fashionNote.length).toBeGreaterThan(0);
      expect(VALID_SEASONS).toContain(note.season);
    });
  });

  test('KATHMANDU_LOCAL_BRANDS entries all have non-empty name and description', () => {
    expect(ki.KATHMANDU_LOCAL_BRANDS.length).toBeGreaterThanOrEqual(15);
    ki.KATHMANDU_LOCAL_BRANDS.forEach(brand => {
      expect(brand.name.length).toBeGreaterThan(0);
      expect(brand.description.length).toBeGreaterThan(0);
    });
  });

  test('KATHMANDU_TRENDS_2025 was expanded to at least 20 entries', () => {
    expect(ki.KATHMANDU_TRENDS_2025.length).toBeGreaterThanOrEqual(20);
  });
});

describe('kathmanduIntelligence.getActiveFestivals — DB-first with hardcoded fallback', () => {
  afterEach(() => jest.restoreAllMocks());

  test('falls back to the hardcoded NEPAL_FESTIVALS data when the DB query throws', async () => {
    jest.spyOn(KathmanduTrend, 'find').mockImplementation(() => ({
      sort: () => ({ lean: () => Promise.reject(new Error('DB unavailable')) }),
    }));

    const result = await ki.getActiveFestivals();
    // Must not throw, and must still return the expected shape from the
    // hardcoded fallback path.
    expect(result).toHaveProperty('current');
    expect(result).toHaveProperty('upcoming');
    expect(result).toHaveProperty('hasFestivalNow');
    expect(result).toHaveProperty('primaryFestival');
  });

  test('uses DB data when the collection has matching documents', async () => {
    const month = new Date().getMonth() + 1;
    jest.spyOn(KathmanduTrend, 'find').mockImplementation((query) => ({
      sort: () => ({
        lean: () => Promise.resolve(
          query.festivalMonth === month
            ? [{ name: 'Test DB Festival', type: 'festival', isTraditional: true, popularity: 90, fashionNote: 'Test note' }]
            : []
        ),
      }),
    }));

    const result = await ki.getActiveFestivals();
    expect(result.current.some(f => f.name === 'Test DB Festival')).toBe(true);
  });
});
