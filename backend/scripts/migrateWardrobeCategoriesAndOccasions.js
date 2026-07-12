'use strict';

// ── One-time WardrobeItem category/occasion migration ──────────────────────
// Backs the category enum shrink (7 -> 5 values: tops/bottoms/dresses/
// footwear/accessories) and the new required canonical `occasion` enum
// (backend/constants/occasions.js). Idempotent — safe to re-run; a second
// pass makes zero further changes.
//
// (a) category: 'jackets' -> 'tops' (blazers/jackets are Top examples per spec).
// (b) category: 'traditional' -> 'dresses' if isCompleteOutfit or a dress-set
//     keyword match, else 'tops'/'bottoms' by keyword, else default 'tops'
//     with 'category' flagged in unverifiedFields for the user to confirm on
//     next edit (reuses the existing AiBadge "please verify" UI — no new UI).
// (c) occasion: free text -> one of the 5 canonical group values, via exact
//     match, then a synonym table, else default 'daily' + flagged unverified.
//     The synonym table covers two historical layers: the original pre-
//     migration free text AND the intermediate 16-value canonical list this
//     same script briefly enforced before the vocabulary was collapsed to 5
//     broad groups — both are safe to re-run against.
//
// Deploy this script + the schema's new required/enum constraints together —
// run it immediately after deploying, before resuming normal use.
// Usage: node scripts/migrateWardrobeCategoriesAndOccasions.js

require('dotenv').config();
const mongoose = require('mongoose');
const WardrobeItem = require('../models/WardrobeItem');
const { OCCASIONS } = require('../constants/occasions');

const DRESS_KW  = /saree|sari|lehenga|gown|jumpsuit|co-?ord|sharara|gharara|mekhli|frock/i;
const TOP_KW    = /kurti|kurta|blouse|shirt|top|choli/i;
const BOTTOM_KW = /salwar|churidar|legging|palazzo|pant|trouser|skirt|dhoti/i;

const CANONICAL_OCCASIONS = new Set(OCCASIONS);

const OCCASION_SYNONYMS = {
  // Original pre-migration free text -> one of the 5 canonical groups.
  daily: 'daily', casual_outing: 'daily', cafe: 'daily', shopping: 'daily',
  brunch: 'daily', hangout: 'daily', work: 'office',
  religious: 'traditional', pooja: 'traditional', puja: 'traditional',
  dashain: 'traditional', tihar: 'traditional', teej: 'traditional',
  traditional_ceremony: 'traditional', graduation: 'traditional',
  interview: 'office', meeting: 'office',
  birthday: 'party',
  trekking: 'sports', workout: 'sports',
  function: 'daily',

  // The intermediate 16-value canonical list (briefly enforced by an earlier
  // version of this script) -> the 5 collapsed groups. 'office', 'party',
  // and 'traditional' already ARE canonical group keys, so no entry needed.
  casual: 'daily', college: 'daily', travel: 'daily', home: 'daily',
  vacation: 'daily', family_gathering: 'daily', other: 'daily',
  business: 'office', formal: 'office',
  wedding: 'traditional', festival: 'traditional',
  date: 'party',
  gym: 'sports',
};

// ── (a)+(b) category classification, exported for unit testing ─────────────
function classifyLegacyCategory(item) {
  const text = `${item.subcategory || ''} ${item.name || ''}`;
  if (item.isCompleteOutfit === true || DRESS_KW.test(text))  return { category: 'dresses', unverified: false };
  if (TOP_KW.test(text))    return { category: 'tops',    unverified: false };
  if (BOTTOM_KW.test(text)) return { category: 'bottoms', unverified: false };
  return { category: 'tops', unverified: true };
}

// ── (c) occasion classification, exported for unit testing ─────────────────
function classifyOccasion(rawOccasion) {
  const raw = (rawOccasion || '').toLowerCase().trim().replace(/[\s-]/g, '_');
  if (CANONICAL_OCCASIONS.has(raw)) return { occasion: raw, alreadyCanonical: true, unverified: false };
  const mapped = OCCASION_SYNONYMS[raw];
  if (mapped) return { occasion: mapped, alreadyCanonical: false, unverified: false };
  return { occasion: 'daily', alreadyCanonical: false, unverified: true };
}

function flagUnverified(item, field) {
  if (!item.unverifiedFields.includes(field)) item.unverifiedFields.push(field);
  item.metadataReviewed = false;
}

async function migrateJackets() {
  const res = await WardrobeItem.updateMany({ category: 'jackets' }, { $set: { category: 'tops' } });
  const n = res.modifiedCount ?? res.nModified ?? 0;
  console.log(`jackets -> tops: ${n} updated`);
  return n;
}

async function migrateTraditional() {
  const items = await WardrobeItem.find({ category: 'traditional' });
  let dressN = 0, topN = 0, bottomN = 0, unverifiedN = 0;
  for (const item of items) {
    const { category, unverified } = classifyLegacyCategory(item);
    item.category = category;
    if (category === 'dresses') dressN++;
    else if (category === 'bottoms') bottomN++;
    else topN++;
    if (unverified) { flagUnverified(item, 'category'); unverifiedN++; }
    // validateModifiedOnly: this pass only touches category/unverifiedFields/
    // metadataReviewed — a document whose occasion is still a pre-migration
    // free-text value (fixed by migrateOccasions, run separately) must not
    // block this save just because Mongoose would otherwise validate the
    // whole document on every .save() call.
    await item.save({ validateModifiedOnly: true });
  }
  console.log(`traditional -> dresses:${dressN} tops:${topN} bottoms:${bottomN} (${unverifiedN} flagged unverified)`);
  return { dressN, topN, bottomN, unverifiedN };
}

async function migrateOccasions() {
  const items = await WardrobeItem.find({});
  let mapped = 0, defaulted = 0, alreadyOk = 0;
  for (const item of items) {
    const { occasion, alreadyCanonical, unverified } = classifyOccasion(item.occasion);
    if (alreadyCanonical) {
      if (item.occasion !== occasion) { item.occasion = occasion; await item.save({ validateModifiedOnly: true }); }
      alreadyOk++;
      continue;
    }
    item.occasion = occasion;
    if (unverified) { flagUnverified(item, 'occasion'); defaulted++; }
    else mapped++;
    // validateModifiedOnly: same reasoning as migrateTraditional() above — a
    // document whose category is still a pre-migration value must not block
    // fixing its occasion in this separate pass.
    await item.save({ validateModifiedOnly: true });
  }
  console.log(`occasion: ${alreadyOk} already canonical, ${mapped} synonym-mapped, ${defaulted} defaulted to 'daily' (flagged unverified)`);
  return { alreadyOk, mapped, defaulted };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  await migrateJackets();
  await migrateTraditional();
  await migrateOccasions();
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch(err => { console.error('Migration failed:', err); process.exit(1); });
}

module.exports = {
  classifyLegacyCategory, classifyOccasion,
  migrateJackets, migrateTraditional, migrateOccasions, main,
};
