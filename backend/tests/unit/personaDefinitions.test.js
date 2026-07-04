'use strict';

const { expandArchetypesToPersonas, SCORE_DIMENSIONS, ARCHETYPES } = require('../../scripts/personaDefinitions');

describe('personaDefinitions.expandArchetypesToPersonas', () => {
  const personas = expandArchetypesToPersonas(3);

  test('produces 30 personas (10 archetypes x 3 each)', () => {
    expect(ARCHETYPES.length).toBe(10);
    expect(personas.length).toBe(30);
  });

  test('every persona has a unique personaId', () => {
    const ids = personas.map(p => p.personaId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every persona\'s 9-dimension weight vector sums to ~1', () => {
    personas.forEach(p => {
      const sum = Object.values(p.weights).reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - 1)).toBeLessThan(1e-6);
    });
  });

  test('weight vectors cover exactly the 9 known scoring dimensions', () => {
    personas.forEach(p => {
      expect(Object.keys(p.weights).sort()).toEqual([...SCORE_DIMENSIONS].sort());
    });
  });

  test('jittered numeric fields stay within their declared/reasonable bounds', () => {
    personas.forEach(p => {
      expect(p.idealTempC).toBeGreaterThanOrEqual(12);
      expect(p.idealTempC).toBeLessThanOrEqual(28);
      expect(p.traditionalAffinity).toBeGreaterThanOrEqual(0);
      expect(p.traditionalAffinity).toBeLessThanOrEqual(1);
      expect(p.meanQuality).toBeGreaterThanOrEqual(45);
      expect(p.meanQuality).toBeLessThanOrEqual(72);
      expect(p.stdQuality).toBeGreaterThanOrEqual(10);
      expect(p.stdQuality).toBeLessThanOrEqual(26);
      expect(p.midpoint).toBeGreaterThanOrEqual(45);
      expect(p.midpoint).toBeLessThanOrEqual(65);
      expect(p.steepness).toBeGreaterThanOrEqual(7);
      expect(p.steepness).toBeLessThanOrEqual(18);
    });
  });

  test('each persona carries a non-empty style profile (occasions, styles, colors, fabrics)', () => {
    personas.forEach(p => {
      expect(p.topOccasions.length).toBeGreaterThan(0);
      expect(p.fashionStyles.length).toBeGreaterThan(0);
      expect(p.colorPreferences.length).toBeGreaterThan(0);
      expect(p.fabricPreferences.length).toBeGreaterThan(0);
    });
  });

  test('countPerArchetype controls the total persona count', () => {
    expect(expandArchetypesToPersonas(1).length).toBe(10);
    expect(expandArchetypesToPersonas(5).length).toBe(50);
  });
});
