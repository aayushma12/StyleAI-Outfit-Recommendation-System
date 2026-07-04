'use strict';

// ── Seed WeatherHistory from KATHMANDU_CLIMATE reference normals ───────────
// Explicitly the honest minimum: 12 rows (one per month) sourced from the
// existing hardcoded climate table, labeled source: 'reference_climate_normal'.
// A real Open-Meteo historical-archive pull is out of scope for this pass —
// no confirmed gap requires day-level historical weather.
// Idempotent — safe to re-run; upserts by month.
//
// Usage: node scripts/seedHistoricalWeather.js

require('dotenv').config();
const mongoose = require('mongoose');
const WeatherHistory = require('../models/WeatherHistory');
const { KATHMANDU_CLIMATE } = require('../services/kathmanduIntelligence');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to Mongo. Seeding WeatherHistory...');

  let count = 0;
  for (const [month, climate] of Object.entries(KATHMANDU_CLIMATE)) {
    await WeatherHistory.findOneAndUpdate(
      { month: Number(month) },
      {
        month: Number(month),
        monthName: climate.name,
        avgTemp: climate.avgTemp,
        minTemp: climate.range[0],
        maxTemp: climate.range[1],
        humidity: climate.humidity,
        rainfall: climate.rainfall,
        season: climate.season,
        notes: climate.fashionNote,
        source: 'reference_climate_normal',
      },
      { upsert: true, new: true }
    );
    count++;
  }

  console.log(`Seeded ${count} months of historical weather reference data.`);
  await mongoose.disconnect();
}

main().catch(err => { console.error('Seed failed:', err); process.exit(1); });
