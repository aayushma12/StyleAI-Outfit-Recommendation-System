'use strict';

const mongoose = require('mongoose');
const WardrobeItem = require('../../models/WardrobeItem');
const {
  migrateJackets, migrateTraditional, migrateOccasions,
} = require('../../scripts/migrateWardrobeCategoriesAndOccasions');

// Legacy-shaped documents (retired category values, non-canonical occasion
// strings) can no longer be created through the Mongoose model — its schema
// now enforces the new enums. Insert directly via the raw driver to simulate
// pre-migration data, exactly as this project's established pattern already
// does elsewhere for testing time-window/legacy-shape logic.
async function insertLegacy(doc) {
  const res = await WardrobeItem.collection.insertOne({
    user: new mongoose.Types.ObjectId(),
    name: 'Legacy Item',
    color: 'black',
    unverifiedFields: [],
    metadataReviewed: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...doc,
  });
  return res.insertedId;
}

describe('migrateWardrobeCategoriesAndOccasions — jackets -> tops', () => {
  test('migrates every jackets-category document to tops', async () => {
    const id = await insertLegacy({ name: 'Denim Jacket', category: 'jackets', occasion: 'casual' });
    await migrateJackets();
    const item = await WardrobeItem.findById(id);
    expect(item.category).toBe('tops');
  });

  test('is idempotent — a second run makes no further changes', async () => {
    await insertLegacy({ name: 'Denim Jacket', category: 'jackets', occasion: 'casual' });
    const firstCount = await migrateJackets();
    const secondCount = await migrateJackets();
    expect(firstCount).toBe(1);
    expect(secondCount).toBe(0);
  });
});

describe('migrateWardrobeCategoriesAndOccasions — traditional -> tops/bottoms/dresses', () => {
  test('isCompleteOutfit:true classifies as dresses', async () => {
    const id = await insertLegacy({ name: "Grandmother's Saree", category: 'traditional', isCompleteOutfit: true, occasion: 'wedding' });
    await migrateTraditional();
    const item = await WardrobeItem.findById(id);
    expect(item.category).toBe('dresses');
  });

  test('a keyword-matched top classifies as tops without needing review', async () => {
    const id = await insertLegacy({ name: 'Cotton Kurta', category: 'traditional', occasion: 'casual' });
    await migrateTraditional();
    const item = await WardrobeItem.findById(id);
    expect(item.category).toBe('tops');
    expect(item.unverifiedFields).not.toContain('category');
  });

  test('a keyword-matched bottom classifies as bottoms', async () => {
    const id = await insertLegacy({ name: 'Beige Palazzo Pants', category: 'traditional', occasion: 'casual' });
    await migrateTraditional();
    const item = await WardrobeItem.findById(id);
    expect(item.category).toBe('bottoms');
  });

  test('no keyword match defaults to tops and flags "category" for user review', async () => {
    const id = await insertLegacy({ name: "Grandmother's Heirloom", category: 'traditional', occasion: 'festival' });
    await migrateTraditional();
    const item = await WardrobeItem.findById(id);
    expect(item.category).toBe('tops');
    expect(item.unverifiedFields).toContain('category');
    expect(item.metadataReviewed).toBe(false);
  });
});

describe('migrateWardrobeCategoriesAndOccasions — a document invalid in both category AND occasion at once', () => {
  // Regression test: Mongoose's .save() validates the WHOLE in-memory document,
  // not just the fields touched in a given pass. A document that needs BOTH a
  // category fix (traditional -> tops/bottoms/dresses) and an occasion fix
  // (e.g. 'religious' -> 'traditional') used to fail on the very first pass's
  // .save() call, because the *other*, not-yet-fixed field was still enum-invalid
  // — aborting the whole migration run. Fixed via { validateModifiedOnly: true }.
  test('migrateTraditional does not fail on a document whose occasion is still non-canonical', async () => {
    const id = await insertLegacy({ name: 'Cotton Kurta', category: 'traditional', occasion: 'religious' });
    await expect(migrateTraditional()).resolves.toBeDefined();
    const item = await WardrobeItem.findById(id);
    expect(item.category).toBe('tops');
    expect(item.occasion).toBe('religious'); // untouched by this pass, still pending migrateOccasions
  });

  test('migrateOccasions does not fail on a document whose category is still non-canonical', async () => {
    const id = await insertLegacy({ name: 'Cotton Kurta', category: 'traditional', occasion: 'religious' });
    await expect(migrateOccasions()).resolves.toBeDefined();
    const item = await WardrobeItem.findById(id);
    expect(item.occasion).toBe('traditional');
    expect(item.category).toBe('traditional'); // untouched by this pass, still pending migrateTraditional
  });

  test('running both passes in sequence (as main() does) fully migrates a doubly-invalid document', async () => {
    const id = await insertLegacy({ name: 'Cotton Kurta', category: 'traditional', occasion: 'religious' });
    await migrateTraditional();
    await migrateOccasions();
    const item = await WardrobeItem.findById(id);
    expect(item.category).toBe('tops');
    expect(item.occasion).toBe('traditional');
  });
});

describe('migrateWardrobeCategoriesAndOccasions — occasion -> canonical 5-group vocabulary', () => {
  test('an already-canonical occasion is left untouched', async () => {
    const id = await insertLegacy({ name: 'Item', category: 'tops', occasion: 'traditional' });
    await migrateOccasions();
    const item = await WardrobeItem.findById(id);
    expect(item.occasion).toBe('traditional');
  });

  test('a known synonym (from the retired 16-value list) gets mapped onto its canonical group', async () => {
    const id = await insertLegacy({ name: 'Item', category: 'tops', occasion: 'casual' });
    await migrateOccasions();
    const item = await WardrobeItem.findById(id);
    expect(item.occasion).toBe('daily');
  });

  test('an unrecognized occasion defaults to "daily" and flags "occasion" for review', async () => {
    const id = await insertLegacy({ name: 'Item', category: 'tops', occasion: 'made up occasion' });
    await migrateOccasions();
    const item = await WardrobeItem.findById(id);
    expect(item.occasion).toBe('daily');
    expect(item.unverifiedFields).toContain('occasion');
  });

  test('is idempotent — a second run makes no further changes', async () => {
    await insertLegacy({ name: 'Item', category: 'tops', occasion: 'casual_outing' });
    const first = await migrateOccasions();
    const second = await migrateOccasions();
    expect(first.mapped).toBe(1);
    expect(second.alreadyOk).toBe(1);
    expect(second.mapped).toBe(0);
    expect(second.defaulted).toBe(0);
  });
});
