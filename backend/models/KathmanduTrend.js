'use strict';
const mongoose = require('mongoose');

const kathmanduTrendSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 120 },
  type: {
    type: String,
    required: true,
    enum: ['fashion_trend', 'seasonal', 'festival', 'venue', 'local_brand'],
  },
  description:   { type: String, trim: true, maxlength: 600, default: '' },
  fashionNote:   { type: String, trim: true, maxlength: 300, default: '' },
  season: [{
    type: String,
    enum: ['spring', 'summer', 'monsoon', 'autumn', 'winter', 'all'],
  }],
  occasion:      [{ type: String, trim: true }],
  venue:         [{ type: String, trim: true }],
  colors:        [{ type: String, trim: true }],
  styles:        [{ type: String, trim: true }],
  festivalMonth: { type: Number, min: 1, max: 12, default: null },
  isTraditional: { type: Boolean, default: false },
  popularity:    { type: Number, default: 50, min: 0, max: 100 },
  isActive:      { type: Boolean, default: true },
  imageUrl:      { type: String, trim: true, default: '' },
  tags:          [{ type: String, trim: true }],
}, { timestamps: true });

kathmanduTrendSchema.index({ type: 1, isActive: 1 });
kathmanduTrendSchema.index({ popularity: -1 });
kathmanduTrendSchema.index({ festivalMonth: 1 });
kathmanduTrendSchema.index({ season: 1, isActive: 1 });

module.exports = mongoose.model('KathmanduTrend', kathmanduTrendSchema);
