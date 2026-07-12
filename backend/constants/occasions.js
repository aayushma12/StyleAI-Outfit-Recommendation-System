// Canonical occasion vocabulary — the single source of truth for every
// occasion value stored on a WardrobeItem, used to request recommendations,
// or matched against in the fashion compatibility engine.
//
// 5 broad, easy-to-scan groups (not a long granular list) — chosen so the
// fast-upload flow stays a few-second decision while still covering almost
// every real-life situation. Must stay in sync with
// frontend/src/constants/occasions.js.
const OCCASIONS = [
  'sports',
  'daily',
  'party',
  'office',
  'traditional',
];

module.exports = { OCCASIONS };
