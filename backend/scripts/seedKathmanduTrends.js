'use strict';

// ── Seed KathmanduTrend from the hardcoded festival/trend/venue data ────────
// The KathmanduTrend model has had full admin CRUD since before this redesign,
// but nothing ever populated it — kathmanduIntelligence.js read from hardcoded
// JS constants instead. Now that getActiveFestivals()/getTrendingStyles() are
// DB-first, this script gives the admin panel real, editable seed data.
// Idempotent — safe to re-run; upserts by name.
//
// Usage: node scripts/seedKathmanduTrends.js

require('dotenv').config();
const mongoose = require('mongoose');
const KathmanduTrend = require('../models/KathmanduTrend');
const {
  NEPAL_FESTIVALS, KATHMANDU_TRENDS_2025, KATHMANDU_VENUES,
  KATHMANDU_SEASONAL_NOTES, KATHMANDU_LOCAL_BRANDS,
} = require('../services/kathmanduIntelligence');

async function seedFestivals() {
  let count = 0;
  for (const [month, festivals] of Object.entries(NEPAL_FESTIVALS)) {
    for (const f of festivals) {
      await KathmanduTrend.findOneAndUpdate(
        { name: f.name, type: 'festival' },
        {
          name: f.name, type: 'festival',
          description: f.note, fashionNote: f.note,
          festivalMonth: Number(month),
          isTraditional: !!f.traditional,
          colors: f.color ? [f.color] : [],
          popularity: f.type === 'major' ? 90 : f.traditional ? 70 : 55,
          isActive: true,
        },
        { upsert: true, new: true }
      );
      count++;
    }
  }
  return count;
}

async function seedTrends() {
  let count = 0;
  for (const description of KATHMANDU_TRENDS_2025) {
    const name = description.split(/[—-]/)[0].trim().slice(0, 100);
    await KathmanduTrend.findOneAndUpdate(
      { name, type: 'fashion_trend' },
      { name, type: 'fashion_trend', description, popularity: 60, isActive: true },
      { upsert: true, new: true }
    );
    count++;
  }
  return count;
}

async function seedVenues() {
  let count = 0;
  for (const [key, v] of Object.entries(KATHMANDU_VENUES)) {
    await KathmanduTrend.findOneAndUpdate(
      { name: key, type: 'venue' },
      {
        name: key, type: 'venue',
        description: v.note, fashionNote: v.note,
        venue: [key], tags: [v.vibe], popularity: 50, isActive: true,
      },
      { upsert: true, new: true }
    );
    count++;
  }
  return count;
}

async function seedSeasonalNotes() {
  let count = 0;
  for (const note of KATHMANDU_SEASONAL_NOTES) {
    await KathmanduTrend.findOneAndUpdate(
      { name: note.name, type: 'seasonal' },
      {
        name: note.name, type: 'seasonal',
        description: note.fashionNote, fashionNote: note.fashionNote,
        season: [note.season], festivalMonth: note.month,
        popularity: 55, isActive: true,
      },
      { upsert: true, new: true }
    );
    count++;
  }
  return count;
}

async function seedLocalBrands() {
  let count = 0;
  for (const brand of KATHMANDU_LOCAL_BRANDS) {
    await KathmanduTrend.findOneAndUpdate(
      { name: brand.name, type: 'local_brand' },
      {
        name: brand.name, type: 'local_brand',
        description: brand.description, popularity: 50, isActive: true,
      },
      { upsert: true, new: true }
    );
    count++;
  }
  return count;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to Mongo. Seeding KathmanduTrend...');

  const [festivalCount, trendCount, venueCount, seasonalCount, localBrandCount] = await Promise.all([
    seedFestivals(), seedTrends(), seedVenues(), seedSeasonalNotes(), seedLocalBrands(),
  ]);

  console.log(`Seeded ${festivalCount} festivals, ${trendCount} fashion trends, ${venueCount} venues, ${seasonalCount} seasonal notes, ${localBrandCount} local brand categories.`);
  await mongoose.disconnect();
}

main().catch(err => { console.error('Seed failed:', err); process.exit(1); });
