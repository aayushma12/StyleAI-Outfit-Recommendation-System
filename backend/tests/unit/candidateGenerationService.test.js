'use strict';

const cand = require('../../services/candidateGenerationService');

let idCounter = 0;
const mkItem = (fields) => ({ _id: `id${idCounter++}`, ...fields });

function buildSampleWardrobe() {
  return [
    mkItem({ name: 'White Cotton Shirt', category: 'tops', color: 'white', occasion: 'office', formalityLevel: 2 }),
    mkItem({ name: 'Blue Denim Top', category: 'tops', color: 'blue', occasion: 'daily', formalityLevel: 1 }),
    mkItem({ name: 'Black Trousers', category: 'bottoms', color: 'black', occasion: 'office', formalityLevel: 2 }),
    mkItem({ name: 'Blue Jeans', category: 'bottoms', color: 'blue denim', occasion: 'daily', formalityLevel: 1 }),
    mkItem({ name: 'Denim Jacket', category: 'jackets', color: 'blue', occasion: 'daily', formalityLevel: 1 }),
    mkItem({ name: 'White Sneakers', category: 'footwear', color: 'white', occasion: 'daily', formalityLevel: 1 }),
    mkItem({ name: 'Black Heels', category: 'footwear', color: 'black', occasion: 'office', formalityLevel: 3 }),
    mkItem({ name: 'Gold Hoop Earrings', category: 'accessories', subcategory: 'earrings', color: 'gold' }),
    mkItem({ name: 'Nude Tote Bag', category: 'accessories', subcategory: 'tote bag', color: 'beige' }),
  ];
}

describe('candidateGenerationService.generateCandidates', () => {
  test('produces at least one complete candidate for a normal wardrobe', () => {
    const candidates = cand.generateCandidates({}, buildSampleWardrobe(), { occasion: 'office', weather: { temp: 20 } });
    expect(candidates.length).toBeGreaterThan(0);
    const first = candidates[0];
    expect(first.slots.top).toBeDefined();
    expect(first.slots.footwear).toBeDefined();
  });

  test('every candidate has either a top+bottom or a dress, never both empty and neither filled', () => {
    const candidates = cand.generateCandidates({}, buildSampleWardrobe(), { occasion: 'daily', weather: { temp: 22 } });
    for (const c of candidates) {
      const hasTop    = !!(c.slots.top.name || c.slots.top.suggestion);
      const hasBottom = !!(c.slots.bottom.name || c.slots.bottom.suggestion);
      const hasDress  = !!(c.slots.dress.name || c.slots.dress.suggestion);
      expect(hasDress || (hasTop && hasBottom)).toBe(true);
    }
  });

  test('cool weather (14-20°C) attaches outerwear when something suitable is owned', () => {
    const candidates = cand.generateCandidates({}, buildSampleWardrobe(), { occasion: 'daily', weather: { temp: 16 } });
    const withOuterwear = candidates.some(c => c.slots.outerwear.name === 'Denim Jacket');
    expect(withOuterwear).toBe(true);
  });

  test('an empty wardrobe still produces a fully-suggested fallback outfit rather than crashing', () => {
    const candidates = cand.generateCandidates({}, [], { occasion: 'daily', weather: { temp: 22 } });
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].needsSuggestion.length).toBeGreaterThan(0);
    expect(candidates[0].slots.top.suggestion.length).toBeGreaterThan(0);
  });

  test('wardrobeOnly mode (allowSuggestions=false) on a sparse wardrobe returns zero candidates rather than fabricating one', () => {
    const candidates = cand.generateCandidates({}, [], { occasion: 'daily', weather: { temp: 22 }, allowSuggestions: false });
    expect(candidates.length).toBe(0);
  });

  test('accessories respect the maxAccessories override (wizard "minimal accessories" mode)', () => {
    const wardrobe = buildSampleWardrobe();
    const withMax1 = cand.generateCandidates({}, wardrobe, { occasion: 'daily', weather: { temp: 22 }, maxAccessories: 1 });
    for (const c of withMax1) {
      const accessorySlots = ['jewelry', 'bag', 'watch', 'scarf', 'sunglasses', 'hair_accessory', 'belt'];
      const filled = accessorySlots.filter(s => c.slots[s].name || c.slots[s].suggestion);
      expect(filled.length).toBeLessThanOrEqual(1);
    }
  });
});

describe('candidateGenerationService.resolveSlot', () => {
  test('maps top-level categories directly to their slot', () => {
    expect(cand.resolveSlot({ category: 'tops' })).toBe('top');
    expect(cand.resolveSlot({ category: 'bottoms' })).toBe('bottom');
    expect(cand.resolveSlot({ category: 'footwear' })).toBe('footwear');
  });

  test('classifies accessories by subcategory/name keyword when available', () => {
    expect(cand.resolveSlot({ category: 'accessories', name: 'Gold Earrings' })).toBe('jewelry');
    expect(cand.resolveSlot({ category: 'accessories', name: 'Leather Tote Bag' })).toBe('bag');
    expect(cand.resolveSlot({ category: 'accessories', name: 'Silver Watch' })).toBe('watch');
  });

  test('classifies traditional garments by keyword (dress-like vs top-like)', () => {
    expect(cand.resolveSlot({ category: 'traditional', name: 'Red Saree' })).toBe('dress');
    expect(cand.resolveSlot({ category: 'traditional', name: 'Cotton Kurta' })).toBe('top');
  });
});
