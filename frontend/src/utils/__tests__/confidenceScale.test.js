import { getMatchBadge, getMeterColor } from '../confidenceScale';

describe('confidenceScale.getMatchBadge', () => {
  test('confidence >= 85 is "Perfect Match" (high tier)', () => {
    expect(getMatchBadge(90).text).toBe('Perfect Match');
    expect(getMatchBadge(90).label).toBe('High');
  });

  test('confidence between 70 and 84 is "Great Match" (medium tier)', () => {
    expect(getMatchBadge(75).text).toBe('Great Match');
    expect(getMatchBadge(75).label).toBe('Medium');
  });

  test('confidence below 70 is "Good Match" (low tier)', () => {
    expect(getMatchBadge(50).text).toBe('Good Match');
    expect(getMatchBadge(50).label).toBe('Low');
  });

  test('boundary values resolve to the correct tier', () => {
    expect(getMatchBadge(85).label).toBe('High');
    expect(getMatchBadge(84).label).toBe('Medium');
    expect(getMatchBadge(70).label).toBe('Medium');
    expect(getMatchBadge(69).label).toBe('Low');
  });

  test('every badge has the fields consumers rely on (text, label, color, bg, border)', () => {
    const badge = getMatchBadge(90);
    expect(badge).toHaveProperty('text');
    expect(badge).toHaveProperty('label');
    expect(badge).toHaveProperty('color');
    expect(badge).toHaveProperty('bg');
    expect(badge).toHaveProperty('border');
  });
});

describe('confidenceScale.getMeterColor', () => {
  test('uses default thresholds (good=70, warn=40) when none are given', () => {
    expect(getMeterColor(80)).toBe('#059669'); // green
    expect(getMeterColor(50)).toBe('#D97706'); // amber
    expect(getMeterColor(20)).toBe('#DC2626'); // red
  });

  test('respects custom thresholds (e.g. ProfileMeter uses good=80, warn=50)', () => {
    expect(getMeterColor(85, { good: 80, warn: 50 })).toBe('#059669');
    expect(getMeterColor(60, { good: 80, warn: 50 })).toBe('#D97706');
    expect(getMeterColor(30, { good: 80, warn: 50 })).toBe('#DC2626');
  });
});
