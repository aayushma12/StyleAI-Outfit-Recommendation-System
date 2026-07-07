'use strict';

const { csvField } = require('../../scripts/exportRecommendationLogs');

describe('exportRecommendationLogs.csvField', () => {
  test('returns an empty string for null/undefined', () => {
    expect(csvField(null)).toBe('');
    expect(csvField(undefined)).toBe('');
  });

  test('passes plain values through unquoted', () => {
    expect(csvField('daily')).toBe('daily');
    expect(csvField(77)).toBe('77');
  });

  test('quotes and escapes a value containing a comma', () => {
    expect(csvField('wrong_color, too_formal')).toBe('"wrong_color, too_formal"');
  });

  test('quotes and doubles internal quotes', () => {
    expect(csvField('she said "nice"')).toBe('"she said ""nice"""');
  });

  test('quotes a value containing a newline', () => {
    expect(csvField('line1\nline2')).toBe('"line1\nline2"');
  });
});
