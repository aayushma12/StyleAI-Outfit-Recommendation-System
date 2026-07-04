'use strict';

// ── Wardrobe AI-metadata backfill (standalone CLI) ──────────────────────────
// Reuses visionExtractionService.js exactly as the live upload flow does —
// this is orchestration only, no changes to the vision pipeline itself.
// Useful for pre-demo prep (tag every existing wardrobe item at once)
// without going through the admin UI's batch-of-20 button.
//
// Usage: node scripts/backfillWardrobeMetadata.js [limit=1000]

require('dotenv').config();
const mongoose = require('mongoose');
const WardrobeItem = require('../models/WardrobeItem');
const visionExtraction = require('../services/visionExtractionService');

async function main() {
  const limit = parseInt(process.argv[2], 10) || 1000;
  await mongoose.connect(process.env.MONGO_URI);

  // 'color-only' means the vision-LLM call failed/was unavailable when this
  // item was last processed — must stay eligible for retry, not be treated
  // as done (see the identical UNTAGGED_PROVIDERS note in adminController.js).
  const items = await WardrobeItem.find({
    imageUrl: { $ne: '' },
    'aiMeta.provider': { $in: ['', null, 'color-only'] },
  }).limit(limit);

  console.log(`Found ${items.length} wardrobe item(s) with an image but no AI metadata yet.`);

  let tagged = 0, failed = 0;
  for (const item of items) {
    try {
      const meta = await visionExtraction.analyzeWardrobeImage(item.imageUrl, item.category);
      Object.assign(item, meta, { metadataReviewed: false });
      await item.save();
      const ok = meta.aiMeta?.provider && meta.aiMeta.provider !== 'color-only';
      if (ok) tagged++;
      console.log(`  ${ok ? '✓' : '·'} ${item.name} (${item._id}) — provider: ${meta.aiMeta?.provider || 'color-only'}`);
    } catch (err) {
      failed++;
      console.warn(`  ✗ ${item.name} (${item._id}) — failed: ${err.message}`);
    }
  }

  console.log(`\nDone. Tagged ${tagged}/${items.length} (${failed} failed).`);
  await mongoose.disconnect();
}

main().catch(err => { console.error('Backfill failed:', err); process.exit(1); });
