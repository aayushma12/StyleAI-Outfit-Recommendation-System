'use strict';

const { checkGrounding } = require('../../services/groundingService');

const WARDROBE = [
  { name: 'Black Leather Jacket', color: 'black', category: 'outerwear' },
  { name: 'Blue Denim Jeans', color: 'blue', category: 'bottoms' },
  { name: 'White Cotton Shirt', color: 'white', category: 'tops' },
];

describe('groundingService.checkGrounding', () => {
  test('a reply referencing a real wardrobe item is not flagged', () => {
    const reply = 'Your black leather jacket would work great with those jeans for a cool evening look.';
    const result = checkGrounding(reply, WARDROBE);
    expect(result.ok).toBe(true);
    expect(result.flaggedPhrases).toEqual([]);
  });

  test('a reply referencing a hallucinated item that does not match the wardrobe is flagged', () => {
    const reply = 'Your emerald green silk saree is stunning and would pair well with gold jewelry.';
    const result = checkGrounding(reply, WARDROBE);
    expect(result.ok).toBe(false);
    expect(result.flaggedPhrases.length).toBeGreaterThan(0);
  });

  test('disclosed-suggestion phrasing ("not in your wardrobe" / "you could buy") is not flagged', () => {
    const reply = 'The emerald green saree you could buy is not in your wardrobe, but it would suit the occasion.';
    const result = checkGrounding(reply, WARDROBE);
    expect(result.ok).toBe(true);
  });

  test('an empty wardrobe does not crash and treats references as ungrounded', () => {
    const reply = 'Your red velvet gown would be perfect.';
    expect(() => checkGrounding(reply, [])).not.toThrow();
    const result = checkGrounding(reply, []);
    expect(result.ok).toBe(false);
  });

  test('empty or missing reply text returns ok with no flagged phrases', () => {
    expect(checkGrounding('', WARDROBE)).toEqual({ ok: true, flaggedPhrases: [] });
    expect(checkGrounding(undefined, WARDROBE)).toEqual({ ok: true, flaggedPhrases: [] });
  });

  test('plain text with no "your/the ___" reference phrasing is never flagged', () => {
    const reply = 'Layering is a great way to stay warm during Kathmandu winters.';
    const result = checkGrounding(reply, WARDROBE);
    expect(result.ok).toBe(true);
  });
});
