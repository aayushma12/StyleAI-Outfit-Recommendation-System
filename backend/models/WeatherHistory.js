'use strict';
const mongoose = require('mongoose');

// ── Historical weather reference (climate normals, not live-measured) ──────
// weatherService.js only caches today's live forecast for 30 minutes — there
// was no durable record of Kathmandu's typical monthly weather for the
// recommendation engine's `weatherFit` scoring dimension or the AI Assistant
// to reference across sessions. This is intentionally the honest minimum:
// one row per month, sourced directly from the existing KATHMANDU_CLIMATE
// reference table (kathmanduIntelligence.js), not a live archive API pull.
const weatherHistorySchema = new mongoose.Schema({
  month:    { type: Number, required: true, min: 1, max: 12, unique: true },
  monthName:{ type: String, required: true, trim: true },
  avgTemp:  { type: Number, required: true },
  minTemp:  { type: Number, required: true },
  maxTemp:  { type: Number, required: true },
  humidity: { type: Number, required: true, min: 0, max: 100 },
  rainfall: { type: String, enum: ['very low', 'low', 'light', 'moderate', 'heavy'], required: true },
  season:   { type: String, enum: ['spring', 'monsoon', 'autumn', 'winter'], required: true },
  notes:    { type: String, trim: true, maxlength: 400, default: '' },
  source:   { type: String, default: 'reference_climate_normal' },
}, { timestamps: true });

module.exports = mongoose.model('WeatherHistory', weatherHistorySchema);
