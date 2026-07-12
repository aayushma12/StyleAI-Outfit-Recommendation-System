'use strict';

// ── Outfit catalog seed (standalone CLI) ────────────────────────────────────
// Populates the `Outfit` catalog collection (until now 100% empty — no admin
// had a reason to hand-add products with no consumer feature reading them)
// with real, occasion/season-tagged entries so candidateGenerationService's
// catalog-matching logic has real data to find.
//
// Deliberately ships with NO images (imageUrl left at its schema default
// '', imageVerified defaults to false) — this seed data is demo/placeholder
// content whose visual accuracy nobody has confirmed, and the system must
// never present an unverified/guessed photo as if it genuinely depicts the
// item. Add real photos afterward via the admin Catalog tab's upload flow
// (or the manual-URL + explicit confirmation checkbox); until then these
// entries render as clean text-only "Suggested Addition" cards, never a
// placeholder or mismatched image. See Recommendation.populateAndSanitize.
//
// occasion values are drawn only from fashionRulesEngine.OCCASION_META keys;
// season values only from WardrobeItem.suitableSeasons's real vocabulary —
// mismatched invented vocabulary would make the matcher silently find nothing.
//
// Idempotent: upserts by `name`, safe to re-run.
// Usage: node scripts/seedOutfitCatalog.js

require('dotenv').config();
const mongoose = require('mongoose');
const Outfit = require('../models/Outfit');

const CATALOG = [
  // ── Tops ──────────────────────────────────────────────────────────────
  { name: 'White Cotton Shirt', category: 'tops', occasion: ['daily', 'office'], season: ['all'], colors: ['white'], style: ['classic', 'minimalist'], fabric: 'cotton', price: 1200 },
  { name: 'Black Fitted Top', category: 'tops', occasion: ['daily', 'party'], season: ['all'], colors: ['black'], style: ['classic', 'edgy'], price: 900 },
  { name: 'Denim Button-Up Top', category: 'tops', occasion: ['daily'], season: ['autumn', 'spring', 'all'], colors: ['blue'], style: ['casual', 'streetwear'], fabric: 'denim', price: 1500 },
  { name: 'Cream Blouse', category: 'tops', occasion: ['office', 'party'], season: ['all'], colors: ['cream', 'beige'], style: ['classic', 'smart_casual'], price: 1400 },
  { name: 'Graphic Tee', category: 'tops', occasion: ['daily', 'sports'], season: ['all'], colors: ['white', 'black'], style: ['streetwear', 'casual'], price: 700 },

  // ── Bottoms ───────────────────────────────────────────────────────────
  { name: 'Black Tailored Trousers', category: 'bottoms', occasion: ['office'], season: ['all'], colors: ['black'], style: ['classic', 'formal'], price: 2000 },
  { name: 'Blue Denim Jeans', category: 'bottoms', occasion: ['daily'], season: ['all'], colors: ['blue'], style: ['casual'], fabric: 'denim', price: 1800 },
  { name: 'Beige Palazzo Pants', category: 'bottoms', occasion: ['daily', 'traditional'], season: ['all'], colors: ['beige'], style: ['boho', 'traditional'], price: 1300 },
  { name: 'Denim Shorts', category: 'bottoms', occasion: ['daily', 'sports'], season: ['spring', 'monsoon', 'all'], colors: ['blue'], style: ['casual', 'streetwear'], price: 900 },
  { name: 'Pleated Midi Skirt', category: 'bottoms', occasion: ['office', 'party', 'daily'], season: ['all'], colors: ['navy'], style: ['smart_casual', 'classic'], price: 1600 },

  // ── Dresses ───────────────────────────────────────────────────────────
  { name: 'Floral Sundress', category: 'dresses', occasion: ['party', 'daily'], season: ['spring', 'all'], colors: ['pink', 'floral'], style: ['romantic', 'boho'], price: 2200 },
  { name: 'Little Black Dress', category: 'dresses', occasion: ['party', 'office'], season: ['all'], colors: ['black'], style: ['classic', 'edgy'], price: 2800 },
  { name: 'Maxi Wrap Dress', category: 'dresses', occasion: ['daily', 'party'], season: ['all'], colors: ['green'], style: ['boho', 'romantic'], price: 2400 },
  { name: 'Bodycon Party Dress', category: 'dresses', occasion: ['party'], season: ['all'], colors: ['red'], style: ['edgy', 'classic'], price: 2600 },

  // ── Outerwear ─────────────────────────────────────────────────────────
  { name: 'Denim Jacket', category: 'outerwear', occasion: ['daily'], season: ['autumn', 'spring', 'all'], colors: ['blue'], style: ['casual', 'streetwear'], price: 1900 },
  { name: 'Wool Overcoat', category: 'outerwear', occasion: ['office', 'daily'], season: ['winter'], colors: ['camel', 'grey'], style: ['classic', 'formal'], fabric: 'wool', price: 4500 },
  { name: 'Structured Blazer', category: 'outerwear', occasion: ['office', 'party'], season: ['all'], colors: ['black', 'navy'], style: ['formal', 'classic'], price: 3200 },
  { name: 'Knit Cardigan', category: 'outerwear', occasion: ['daily'], season: ['autumn', 'winter', 'all'], colors: ['beige'], style: ['minimalist', 'classic'], price: 1700 },

  // ── Footwear ──────────────────────────────────────────────────────────
  { name: 'White Sneakers', category: 'footwear', occasion: ['daily', 'sports'], season: ['all'], colors: ['white'], style: ['casual', 'streetwear'], price: 2500 },
  { name: 'Black Block Heels', category: 'footwear', occasion: ['office', 'party'], season: ['all'], colors: ['black'], style: ['classic', 'formal'], price: 3000 },
  { name: 'Strappy Party Heels', category: 'footwear', occasion: ['party', 'traditional'], season: ['all'], colors: ['gold'], style: ['edgy', 'romantic'], price: 2800 },
  { name: 'Leather Loafers', category: 'footwear', occasion: ['office', 'daily'], season: ['all'], colors: ['brown'], style: ['classic', 'smart_casual'], fabric: 'leather', price: 2600 },
  { name: 'Embellished Juttis', category: 'footwear', occasion: ['traditional'], season: ['all'], colors: ['gold', 'red'], style: ['traditional'], price: 1800 },
  { name: 'Trekking Shoes', category: 'footwear', occasion: ['daily', 'sports'], season: ['all'], colors: ['grey'], style: ['sporty'], price: 3500 },

  // ── Accessories ───────────────────────────────────────────────────────
  { name: 'Gold Hoop Earrings', category: 'accessories', occasion: ['daily', 'party'], season: ['all'], colors: ['gold'], tags: ['earring', 'jewelry'], style: ['classic'], price: 800 },
  { name: 'Pearl Necklace', category: 'accessories', occasion: ['office', 'traditional', 'party'], season: ['all'], colors: ['white', 'pearl'], tags: ['necklace', 'jewelry'], style: ['classic', 'romantic'], price: 1500 },
  { name: 'Jhumka Earrings', category: 'accessories', occasion: ['traditional'], season: ['all'], colors: ['gold'], tags: ['earring', 'jewelry', 'jhumka'], style: ['traditional'], price: 1200 },
  { name: 'Leather Tote Bag', category: 'accessories', occasion: ['office', 'daily'], season: ['all'], colors: ['tan', 'brown'], tags: ['bag', 'tote'], style: ['classic', 'minimalist'], fabric: 'leather', price: 2200 },
  { name: 'Embellished Potli Clutch', category: 'accessories', occasion: ['traditional', 'party'], season: ['all'], colors: ['gold', 'red'], tags: ['bag', 'clutch', 'potli'], style: ['traditional'], price: 1400 },
  { name: 'Silk Dupatta', category: 'accessories', occasion: ['traditional'], season: ['all'], colors: ['red', 'gold'], tags: ['scarf', 'dupatta'], style: ['traditional'], fabric: 'silk', price: 1000 },
  { name: 'Minimalist Wristwatch', category: 'accessories', occasion: ['office', 'daily'], season: ['all'], colors: ['silver', 'black'], tags: ['watch'], style: ['minimalist', 'classic'], price: 3500 },

  // ── Traditional ───────────────────────────────────────────────────────
  { name: 'Red Banarasi Saree', category: 'traditional', occasion: ['traditional'], season: ['all'], colors: ['red', 'gold'], style: ['traditional'], fabric: 'silk', price: 5500 },
  { name: 'Gold-Embroidered Lehenga Set', category: 'traditional', occasion: ['traditional'], season: ['all'], colors: ['gold', 'maroon'], style: ['traditional'], price: 8000 },
  { name: 'Cotton Printed Kurta', category: 'traditional', occasion: ['daily', 'traditional'], season: ['all'], colors: ['blue', 'white'], style: ['traditional', 'casual'], fabric: 'cotton', price: 1300 },
  { name: 'Silk Choli Blouse', category: 'traditional', occasion: ['traditional'], season: ['all'], colors: ['red', 'gold'], style: ['traditional'], fabric: 'silk', price: 1800 },
];

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  let created = 0, updated = 0;
  for (const doc of CATALOG) {
    const res = await Outfit.findOneAndUpdate(
      { name: doc.name },
      // Explicitly clear any previously-seeded placeholder image/verification
      // on re-run, rather than leaving a stale Picsum URL behind.
      { ...doc, imageUrl: '', publicId: '', imageVerified: false, isApproved: true, isActive: true },
      { upsert: true, new: true, setDefaultsOnInsert: true, rawResult: true }
    );
    if (res.lastErrorObject?.updatedExisting) updated++; else created++;
  }

  console.log(`Done. ${created} created, ${updated} updated (${CATALOG.length} total catalog entries, no images — add real photos via the admin Catalog tab).`);
  await mongoose.disconnect();
}

main().catch(err => { console.error('Catalog seed failed:', err); process.exit(1); });
