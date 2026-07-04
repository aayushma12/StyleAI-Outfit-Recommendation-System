'use strict';

// Removes everything created by EITHER synthetic-data generator:
//  - seedSyntheticTrainingBehavior.js (one flat bootstrap user, legacy email)
//  - seedPersonaSyntheticBehavior.js (30 persona users, isSyntheticPersona flag)
// Also catches any Recommendation marked `synthetic: true` directly, in case
// a session outlives its owning user for any reason.
// Usage: node scripts/removeSyntheticTrainingBehavior.js

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Recommendation = require('../models/Recommendation');

const SYNTHETIC_EMAIL = 'synthetic-bootstrap@styleai-synthetic.local';

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const syntheticUsers = await User.find({
    $or: [{ email: SYNTHETIC_EMAIL }, { isSyntheticPersona: true }],
  }).select('_id');

  if (!syntheticUsers.length) {
    const { deletedCount } = await Recommendation.deleteMany({ synthetic: true });
    console.log(deletedCount
      ? `No synthetic users found, but removed ${deletedCount} orphaned synthetic Recommendation session(s).`
      : 'No synthetic users or sessions found — nothing to remove.');
    await mongoose.disconnect();
    return;
  }

  const userIds = syntheticUsers.map(u => u._id);
  const { deletedCount } = await Recommendation.deleteMany({
    $or: [{ user: { $in: userIds } }, { synthetic: true }],
  });
  await User.deleteMany({ _id: { $in: userIds } });

  console.log(`Removed ${deletedCount} synthetic Recommendation sessions and ${userIds.length} synthetic user(s).`);
  await mongoose.disconnect();
}

main().catch(err => { console.error('Cleanup failed:', err); process.exit(1); });
