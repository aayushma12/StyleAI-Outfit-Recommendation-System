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
    mkItem({ name: 'Denim Jacket', category: 'tops', color: 'blue', occasion: 'daily', formalityLevel: 1 }),
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

  test('a wardrobe with only a bottom (no top) still produces a valid, non-rejected candidate with a suggested top', () => {
    const wardrobe = [
      mkItem({ name: 'Trousers', category: 'bottoms', color: 'black', occasion: 'office', formalityLevel: 4 }),
      mkItem({ name: 'Oxford Shoes', category: 'footwear', color: 'black', occasion: 'office', formalityLevel: 4 }),
    ];
    const candidates = cand.generateCandidates({}, wardrobe, { occasion: 'office', weather: { temp: 22 } });
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].slots.bottom.name).toBe('Trousers');
    expect(candidates[0].slots.top.suggestion.length).toBeGreaterThan(0);
    expect(candidates[0].needsSuggestion).toContain('top');
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

  test('accessories are never force-filled with generic suggestion text when none are owned', () => {
    const wardrobe = buildSampleWardrobe().filter(it => it.category !== 'accessories');
    const candidates = cand.generateCandidates({}, wardrobe, { occasion: 'daily', weather: { temp: 22 } });
    const accessorySlots = ['jewelry', 'bag', 'watch', 'scarf', 'sunglasses', 'hair_accessory', 'belt'];
    for (const c of candidates) {
      for (const s of accessorySlots) {
        expect(c.slots[s].name).toBe('');
        expect(c.slots[s].suggestion).toBe('');
      }
    }
  });

  test('a mis-tagged saree (traditional category, non-matching name) with layeringLevel "one_piece" never pairs with a bottom', () => {
    const wardrobe = [
      mkItem({ name: "Grandmother's Heirloom", category: 'traditional', color: 'red', layeringLevel: 'one_piece', occasion: 'traditional', formalityLevel: 3 }),
      mkItem({ name: 'Black Trousers', category: 'bottoms', color: 'black', occasion: 'office', formalityLevel: 2 }),
      mkItem({ name: 'Blue Jeans', category: 'bottoms', color: 'blue denim', occasion: 'daily', formalityLevel: 1 }),
    ];
    const candidates = cand.generateCandidates({}, wardrobe, { occasion: 'traditional', weather: { temp: 22 } });
    for (const c of candidates) {
      const hasDress  = !!(c.slots.dress.name  || c.slots.dress.suggestion);
      const hasBottom = !!(c.slots.bottom.name || c.slots.bottom.suggestion);
      expect(hasDress && hasBottom).toBe(false);
    }
    expect(candidates.some(c => c.slots.dress.name === "Grandmother's Heirloom")).toBe(true);
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

  test('trusts layeringLevel "one_piece" over a non-matching name for traditional items', () => {
    expect(cand.resolveSlot({ category: 'traditional', name: "Grandmother's Heirloom", layeringLevel: 'one_piece' })).toBe('dress');
  });

  test('does not let layeringLevel "one_piece" override an explicit non-traditional category', () => {
    expect(cand.resolveSlot({ category: 'tops', name: 'Odd Top', layeringLevel: 'one_piece' })).toBe('top');
  });

  test('isCompleteOutfit:true resolves to "dress" regardless of category (co-ord/kurta sets, not just traditional)', () => {
    expect(cand.resolveSlot({ category: 'tops', name: 'Cream Co-ord Set', isCompleteOutfit: true })).toBe('dress');
    expect(cand.resolveSlot({ category: 'dresses', name: 'Kurta Set', isCompleteOutfit: true })).toBe('dress');
  });

  test('a category:"tops" item that is actually a blazer/jacket resolves to "outerwear" (jackets folded into tops)', () => {
    expect(cand.resolveSlot({ category: 'tops', name: 'Denim Jacket' })).toBe('outerwear');
    expect(cand.resolveSlot({ category: 'tops', name: 'Structured Blazer' })).toBe('outerwear');
    expect(cand.resolveSlot({ category: 'tops', name: 'Cotton Cardigan', layeringLevel: 'outer' })).toBe('outerwear');
  });

  test('a plain category:"tops" item with no outerwear signal still resolves to "top"', () => {
    expect(cand.resolveSlot({ category: 'tops', name: 'White Cotton Shirt' })).toBe('top');
  });
});

describe('candidateGenerationService.generateCandidates — complete-outfit-set recognition', () => {
  test('a category:"tops" co-ord set marked isCompleteOutfit never gets paired with a bottom', () => {
    const wardrobe = [
      mkItem({ name: 'Cream Co-ord Set', category: 'tops', color: 'cream', isCompleteOutfit: true, occasion: 'daily', formalityLevel: 1 }),
      mkItem({ name: 'Blue Jeans', category: 'bottoms', color: 'blue denim', occasion: 'daily', formalityLevel: 1 }),
    ];
    const candidates = cand.generateCandidates({}, wardrobe, { occasion: 'daily', weather: { temp: 22 } });
    for (const c of candidates) {
      const hasDress  = !!(c.slots.dress.name  || c.slots.dress.suggestion);
      const hasBottom = !!(c.slots.bottom.name || c.slots.bottom.suggestion);
      expect(hasDress && hasBottom).toBe(false);
    }
    expect(candidates.some(c => c.slots.dress.name === 'Cream Co-ord Set')).toBe(true);
  });
});

describe('candidateGenerationService.generateCandidates — wizard preference wiring', () => {
  test('layeringPreference:"heavy" attaches outerwear even in warm weather that would otherwise skip it', () => {
    const wardrobe = buildSampleWardrobe();
    const warm = cand.generateCandidates({}, wardrobe, { occasion: 'daily', weather: { temp: 30 } });
    expect(warm.every(c => !c.slots.outerwear.name && !c.slots.outerwear.suggestion)).toBe(true);

    const heavy = cand.generateCandidates({}, wardrobe, { occasion: 'daily', weather: { temp: 30 }, layeringPreference: 'heavy' });
    expect(heavy.some(c => c.slots.outerwear.name === 'Denim Jacket')).toBe(true);
  });

  test('layeringPreference:"light" skips outerwear even in cold weather that would otherwise require it', () => {
    const wardrobe = buildSampleWardrobe();
    const cold = cand.generateCandidates({}, wardrobe, { occasion: 'daily', weather: { temp: 8 } });
    expect(cold.some(c => c.slots.outerwear.name || c.slots.outerwear.suggestion)).toBe(true);

    const light = cand.generateCandidates({}, wardrobe, { occasion: 'daily', weather: { temp: 8 }, layeringPreference: 'light' });
    expect(light.every(c => !c.slots.outerwear.name && !c.slots.outerwear.suggestion)).toBe(true);
  });

  test('footwearPreference boosts a keyword-matching owned item into the footwear slot, among occasion-tied items', () => {
    const wardrobe = [
      mkItem({ name: 'Canvas Sneakers', category: 'footwear', color: 'white', occasion: 'daily', formalityLevel: 1 }),
      mkItem({ name: 'Strappy Heels', category: 'footwear', color: 'black', occasion: 'daily', formalityLevel: 1 }),
    ];
    const withPref = cand.generateCandidates({}, wardrobe, { occasion: 'daily', weather: { temp: 22 }, footwearPreference: 'heels' });
    expect(withPref.some(c => c.slots.footwear.name === 'Strappy Heels')).toBe(true);
  });

  test('preferredAccessoryTypes reorders which accessory slot wins the single maxAccessories=1 pick', () => {
    const wardrobe = buildSampleWardrobe();
    const defaultOrder = cand.generateCandidates({}, wardrobe, { occasion: 'daily', weather: { temp: 22 }, maxAccessories: 1 });
    expect(defaultOrder.some(c => c.slots.jewelry.name === 'Gold Hoop Earrings')).toBe(true);

    const bagFirst = cand.generateCandidates({}, wardrobe, {
      occasion: 'daily', weather: { temp: 22 }, maxAccessories: 1, preferredAccessoryTypes: ['bag'],
    });
    expect(bagFirst.some(c => c.slots.bag.name === 'Nude Tote Bag')).toBe(true);
    expect(bagFirst.every(c => !c.slots.jewelry.name)).toBe(true);
  });

  test('comfortLevel biases footwear pick toward the formality level it maps to, among occasion-tied items', () => {
    // formalityLevel gaps kept within 1 of 'daily' occasion's own formality (1)
    // so neither item is hard-rejected by the tightened occasion-formality gate —
    // this test is purely about the comfortLevel soft-score tiebreak.
    const wardrobe = [
      mkItem({ name: 'Relaxed Slides', category: 'footwear', color: 'black', occasion: 'daily', formalityLevel: 0 }),
      mkItem({ name: 'Polished Loafers', category: 'footwear', color: 'brown', occasion: 'daily', formalityLevel: 2 }),
    ];
    const relaxed = cand.generateCandidates({}, wardrobe, { occasion: 'daily', weather: { temp: 22 }, comfortLevel: 1 });
    expect(relaxed.some(c => c.slots.footwear.name === 'Relaxed Slides')).toBe(true);

    const dressedUp = cand.generateCandidates({}, wardrobe, { occasion: 'daily', weather: { temp: 22 }, comfortLevel: 5 });
    expect(dressedUp.some(c => c.slots.footwear.name === 'Polished Loafers')).toBe(true);
  });
});

describe('candidateGenerationService.generateCandidates — occasion-strict footwear/accessory rejection', () => {
  test('sneakers never appear in the footwear slot for a traditional/wedding-occasion request', () => {
    const wardrobe = [
      mkItem({ name: 'Silk Top', category: 'tops', color: 'red', occasion: 'traditional', formalityLevel: 4 }),
      mkItem({ name: 'Silk Skirt', category: 'bottoms', color: 'red', occasion: 'traditional', formalityLevel: 4 }),
      mkItem({ name: 'White Sneakers', subcategory: 'sneakers', category: 'footwear', color: 'white', occasion: 'traditional', formalityLevel: 4 }),
      mkItem({ name: 'Embellished Heels', category: 'footwear', color: 'gold', occasion: 'traditional', formalityLevel: 4 }),
    ];
    const candidates = cand.generateCandidates({}, wardrobe, { occasion: 'traditional', weather: { temp: 22 } });
    expect(candidates.some(c => c.slots.footwear.name === 'White Sneakers')).toBe(false);
    expect(candidates.some(c => c.slots.footwear.name === 'Embellished Heels')).toBe(true);
  });

  test('a heavy bridal accessory never appears in an accessory slot for a daily-occasion request', () => {
    const wardrobe = [
      mkItem({ name: 'Basic Tee', category: 'tops', color: 'white', occasion: 'daily', formalityLevel: 1 }),
      mkItem({ name: 'Denim Jeans', category: 'bottoms', color: 'blue', occasion: 'daily', formalityLevel: 1 }),
      mkItem({ name: 'Bridal Necklace', subcategory: 'bridal necklace', category: 'accessories', color: 'gold', occasion: 'daily', formalityLevel: 1 }),
      mkItem({ name: 'Simple Stud Earrings', subcategory: 'simple stud earrings', category: 'accessories', color: 'gold', occasion: 'daily', formalityLevel: 1 }),
    ];
    const candidates = cand.generateCandidates({}, wardrobe, { occasion: 'daily', weather: { temp: 22 } });
    expect(candidates.some(c => c.slots.jewelry.name === 'Bridal Necklace')).toBe(false);
  });
});

let catalogIdCounter = 0;
const mkCatalogItem = (fields) => ({ _id: `catalog${catalogIdCounter++}`, occasion: [], season: [], colors: [], tags: [], ...fields });

describe('candidateGenerationService.bestCatalogMatch', () => {
  test('rejects a catalog item whose occasion array does not include the target occasion', () => {
    const pool = [mkCatalogItem({ name: 'Wedding Heels', category: 'footwear', occasion: ['traditional'] })];
    expect(cand.bestCatalogMatch(pool, 'footwear', [], 'daily', null, '')).toBeNull();
  });

  test('accepts a catalog item with an empty occasion array (universally applicable)', () => {
    const pool = [mkCatalogItem({ name: 'Everyday Sneakers', category: 'footwear' })];
    const match = cand.bestCatalogMatch(pool, 'footwear', [], 'daily', null, '');
    expect(match?.name).toBe('Everyday Sneakers');
  });

  test('rejects a catalog item whose season array does not include the current season or "all"', () => {
    const pool = [mkCatalogItem({ name: 'Wool Coat', category: 'outerwear', season: ['winter'] })];
    expect(cand.bestCatalogMatch(pool, 'outerwear', [], 'daily', 'monsoon', '')).toBeNull();
    expect(cand.bestCatalogMatch(pool, 'outerwear', [], 'daily', 'winter', '')).not.toBeNull();
  });

  test('picks the catalog item with better color harmony among multiple valid matches', () => {
    const pool = [
      mkCatalogItem({ name: 'Muted Yellow Bag', category: 'accessories', colors: ['yellow'] }),
      mkCatalogItem({ name: 'Complementary Teal Bag', category: 'accessories', colors: ['teal'] }),
    ];
    // rules.colorHarmonyScore(['red','yellow']) = 0.65 vs (['red','teal']) = 0.97 (near-complementary hue).
    const match = cand.bestCatalogMatch(pool, 'accessories', ['red'], 'daily', null, '');
    expect(match?.name).toBe('Complementary Teal Bag');
  });

  test('returns null on an empty pool rather than a weak fallback', () => {
    expect(cand.bestCatalogMatch([], 'tops', [], 'daily', null, '')).toBeNull();
    expect(cand.bestCatalogMatch(null, 'tops', [], 'daily', null, '')).toBeNull();
  });
});

describe('candidateGenerationService.generateCandidates — catalog-based "Suggested Addition" items', () => {
  test('a wardrobe with no footwear gets a real catalog product suggestion when one matches the occasion', () => {
    const wardrobe = [
      mkItem({ name: 'White Cotton Shirt', category: 'tops', color: 'white', occasion: 'office', formalityLevel: 2 }),
      mkItem({ name: 'Black Trousers', category: 'bottoms', color: 'black', occasion: 'office', formalityLevel: 2 }),
    ];
    const heels = mkCatalogItem({ name: 'Black Block Heels', category: 'footwear', occasion: ['office'], colors: ['black'] });
    const candidates = cand.generateCandidates({}, wardrobe, { occasion: 'office', weather: { temp: 22 }, catalogItems: [heels] });

    const withCatalogFootwear = candidates.find(c => c.slots.footwear.suggestedItem === heels._id);
    expect(withCatalogFootwear).toBeDefined();
    expect(withCatalogFootwear.slots.footwear.name).toBe('Black Block Heels');
    expect(withCatalogFootwear.slots.footwear.suggestion).toBe(''); // catalog match, not generic text
    expect(withCatalogFootwear.needsSuggestion).toContain('footwear');
  });

  test('falls back to generic suggestion text when the catalog has nothing relevant for the slot/occasion', () => {
    const wardrobe = [
      mkItem({ name: 'White Cotton Shirt', category: 'tops', color: 'white', occasion: 'office', formalityLevel: 2 }),
      mkItem({ name: 'Black Trousers', category: 'bottoms', color: 'black', occasion: 'office', formalityLevel: 2 }),
    ];
    const catalogItems = [mkCatalogItem({ name: 'Trekking Boots', category: 'footwear', occasion: ['sports'] })]; // wrong occasion
    const candidates = cand.generateCandidates({}, wardrobe, { occasion: 'office', weather: { temp: 22 }, catalogItems });

    for (const c of candidates) {
      expect(c.slots.footwear.suggestedItem).toBeNull();
      expect(c.slots.footwear.suggestion.length).toBeGreaterThan(0);
    }
  });

  test('backward compatible: omitting catalogItems entirely still produces the same generic-text fallback behavior', () => {
    const candidates = cand.generateCandidates({}, [], { occasion: 'daily', weather: { temp: 22 } });
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].slots.top.suggestedItem).toBeNull();
    expect(candidates[0].slots.top.suggestion.length).toBeGreaterThan(0);
  });

  test('opportunistically attaches a catalog jewelry suggestion when none is owned, without forcing one when nothing matches', () => {
    const wardrobe = [
      mkItem({ name: 'White Cotton Shirt', category: 'tops', color: 'white', occasion: 'party', formalityLevel: 2 }),
      mkItem({ name: 'Black Trousers', category: 'bottoms', color: 'black', occasion: 'party', formalityLevel: 2 }),
      mkItem({ name: 'Black Heels', category: 'footwear', color: 'black', occasion: 'party', formalityLevel: 2 }),
    ];
    const earrings = mkCatalogItem({ name: 'Gold Hoop Earrings', category: 'accessories', occasion: ['party'], tags: ['earring'] });
    const trekkingWatch = mkCatalogItem({ name: 'Trekking Watch', category: 'accessories', occasion: ['sports'], tags: ['watch'] });

    const matched = cand.generateCandidates({}, wardrobe, { occasion: 'party', weather: { temp: 22 }, catalogItems: [earrings] });
    expect(matched.some(c => c.slots.jewelry.suggestedItem === earrings._id)).toBe(true);

    const unmatched = cand.generateCandidates({}, wardrobe, { occasion: 'party', weather: { temp: 22 }, catalogItems: [trekkingWatch] });
    for (const c of unmatched) {
      expect(c.slots.jewelry.name).toBe('');
      expect(c.slots.jewelry.suggestion).toBe('');
      expect(c.slots.jewelry.suggestedItem).toBeNull();
    }
  });
});
