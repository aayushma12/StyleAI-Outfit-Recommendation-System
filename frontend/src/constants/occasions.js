// Canonical occasion vocabulary — the single source of truth for every
// occasion value a user picks when uploading a wardrobe item, requesting a
// recommendation, or tagging a catalog item.
//
// 5 broad, easy-to-scan groups (not a long granular list) — chosen so the
// fast-upload flow stays a few-second decision while still covering almost
// every real-life situation. Must stay in sync with
// backend/constants/occasions.js.
export const OCCASIONS = [
  'sports',
  'daily',
  'party',
  'office',
  'traditional',
];

export const OCCASION_LABELS = {
  sports: 'Sports / Gym',
  daily: 'Daily / College',
  party: 'Party / Evening',
  office: 'Office / Formal',
  traditional: 'Traditional / Festival / Wedding',
};
