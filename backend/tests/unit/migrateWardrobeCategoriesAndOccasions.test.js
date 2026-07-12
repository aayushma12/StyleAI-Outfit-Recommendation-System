'use strict';

const { classifyLegacyCategory, classifyOccasion } = require('../../scripts/migrateWardrobeCategoriesAndOccasions');

describe('migrateWardrobeCategoriesAndOccasions.classifyLegacyCategory', () => {
  test('isCompleteOutfit:true always classifies as dresses', () => {
    expect(classifyLegacyCategory({ isCompleteOutfit: true, name: 'Odd Name' })).toEqual({ category: 'dresses', unverified: false });
  });

  test('a dress-keyword name (saree/lehenga/gown) classifies as dresses', () => {
    expect(classifyLegacyCategory({ name: 'Red Banarasi Saree' })).toEqual({ category: 'dresses', unverified: false });
    expect(classifyLegacyCategory({ subcategory: 'lehenga set', name: 'Gold Lehenga' })).toEqual({ category: 'dresses', unverified: false });
  });

  test('a top-keyword name (kurti/kurta/blouse) classifies as tops', () => {
    expect(classifyLegacyCategory({ name: 'Cotton Printed Kurta' })).toEqual({ category: 'tops', unverified: false });
    expect(classifyLegacyCategory({ name: 'Silk Choli Blouse' })).toEqual({ category: 'tops', unverified: false });
  });

  test('a bottom-keyword name (salwar/palazzo/legging) classifies as bottoms', () => {
    expect(classifyLegacyCategory({ name: 'Beige Palazzo Pants' })).toEqual({ category: 'bottoms', unverified: false });
    expect(classifyLegacyCategory({ name: 'Cotton Salwar' })).toEqual({ category: 'bottoms', unverified: false });
  });

  test('no keyword match defaults to tops and flags unverified for user review', () => {
    expect(classifyLegacyCategory({ name: "Grandmother's Heirloom" })).toEqual({ category: 'tops', unverified: true });
  });
});

describe('migrateWardrobeCategoriesAndOccasions.classifyOccasion', () => {
  test('an already-canonical value passes through unchanged', () => {
    expect(classifyOccasion('traditional')).toEqual({ occasion: 'traditional', alreadyCanonical: true, unverified: false });
  });

  test('a canonical value with different casing/spacing normalizes and is treated as canonical', () => {
    expect(classifyOccasion('Office')).toEqual({ occasion: 'office', alreadyCanonical: true, unverified: false });
  });

  test('known synonyms (both pre-migration free text and the retired 16-value list) map onto the 5 collapsed groups', () => {
    expect(classifyOccasion('casual')).toEqual({ occasion: 'daily', alreadyCanonical: false, unverified: false });
    expect(classifyOccasion('casual_outing')).toEqual({ occasion: 'daily', alreadyCanonical: false, unverified: false });
    expect(classifyOccasion('pooja')).toEqual({ occasion: 'traditional', alreadyCanonical: false, unverified: false });
    expect(classifyOccasion('wedding')).toEqual({ occasion: 'traditional', alreadyCanonical: false, unverified: false });
    expect(classifyOccasion('interview')).toEqual({ occasion: 'office', alreadyCanonical: false, unverified: false });
    expect(classifyOccasion('trekking')).toEqual({ occasion: 'sports', alreadyCanonical: false, unverified: false });
    expect(classifyOccasion('gym')).toEqual({ occasion: 'sports', alreadyCanonical: false, unverified: false });
    expect(classifyOccasion('date')).toEqual({ occasion: 'party', alreadyCanonical: false, unverified: false });
    expect(classifyOccasion('family_gathering')).toEqual({ occasion: 'daily', alreadyCanonical: false, unverified: false });
  });

  test('an unrecognized value defaults to "daily" and is flagged unverified', () => {
    expect(classifyOccasion('made up occasion')).toEqual({ occasion: 'daily', alreadyCanonical: false, unverified: true });
  });

  test('an empty/missing value defaults to "daily" and is flagged unverified', () => {
    expect(classifyOccasion('')).toEqual({ occasion: 'daily', alreadyCanonical: false, unverified: true });
    expect(classifyOccasion(undefined)).toEqual({ occasion: 'daily', alreadyCanonical: false, unverified: true });
  });
});
