'use strict';

const { STRONG_PASSWORD, escapeRegex, sanitizeEnum, sanitizeEnumArray } = require('../../utils/validation');

describe('validation.escapeRegex', () => {
  test('escapes regex metacharacters so they are treated literally', () => {
    const escaped = escapeRegex('a.b*c');
    expect(new RegExp(escaped).test('aXbXXc')).toBe(false); // would match if "." and "*" were left as regex
    expect(new RegExp(escaped).test('a.b*c')).toBe(true);   // matches the literal string
  });

  test('a pathological-looking pattern is neutralized rather than compiled as regex', () => {
    const input = '(a+)+$';
    expect(() => new RegExp(escapeRegex(input))).not.toThrow();
    expect(new RegExp(escapeRegex(input)).test('(a+)+$')).toBe(true);
  });

  test('handles empty/undefined input safely', () => {
    expect(escapeRegex('')).toBe('');
    expect(escapeRegex(undefined)).toBe('');
  });
});

describe('validation.STRONG_PASSWORD', () => {
  test.each([
    ['StrongP@ss123', true],
    ['weak', false],           // too short, missing everything
    ['alllowercase1!', false], // no uppercase
    ['ALLUPPERCASE1!', false], // no lowercase
    ['NoDigitsHere!', false],  // no digit
    ['NoSpecialChar123', false], // no special character
    ['Sh0rt!', false],         // meets char classes but under 8 chars
  ])('%s -> valid=%s', (password, expected) => {
    expect(STRONG_PASSWORD.test(password)).toBe(expected);
  });
});

describe('validation.sanitizeEnum / sanitizeEnumArray', () => {
  const VALID = ['red', 'blue', 'green'];

  test('sanitizeEnum keeps a valid value and blanks an invalid one', () => {
    expect(sanitizeEnum('red', VALID)).toBe('red');
    expect(sanitizeEnum('purple', VALID)).toBe('');
  });

  test('sanitizeEnumArray filters out invalid entries and de-duplicates', () => {
    expect(sanitizeEnumArray(['red', 'purple', 'blue', 'red'], VALID)).toEqual(['red', 'blue']);
  });

  test('sanitizeEnumArray returns an empty array for non-array input', () => {
    expect(sanitizeEnumArray('red', VALID)).toEqual([]);
    expect(sanitizeEnumArray(undefined, VALID)).toEqual([]);
  });
});
