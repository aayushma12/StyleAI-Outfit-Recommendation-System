const mongoose = require('mongoose');
const explanationSchema = require('./schemas/explanationSchema');

const wardrobeComboSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, trim: true, default: '' },
  items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'WardrobeItem' }],
  matchScore: { type: Number, default: 0, min: 0, max: 100 },
  occasion: { type: String, default: '' },
  weatherSuitable: { type: String, default: '' },
  notes: { type: String, trim: true, maxlength: 300 },
  reasons: [{ type: String }],
  isLiked: { type: Boolean, default: false },

  // ── AI-recommendation provenance (additive — plain manual Outfit Builder
  //    combos simply keep the defaults below and are unaffected) ────────────
  source: { type: String, enum: ['manual', 'recommendation'], default: 'manual' },
  sourceRecommendationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Recommendation', default: null },
  sourceCategory: { type: String, default: '' },
  aiConfidence: { type: Number, default: null, min: 0, max: 100 },
  aiExplanation: { type: explanationSchema, default: () => ({}) },
  season: { type: String, default: '' },
  weatherSnapshot: {
    temp: Number, feelsLike: Number, humidity: Number, windSpeed: Number,
    rainProb: Number, condition: String,
  },
  lastUsedAt: { type: Date, default: null },
  timesReused: { type: Number, default: 0 },

  // Generated asynchronously after save (see outfitPreviewService.js) — a
  // single collage image combining this outfit's item photos. May be empty
  // for a moment right after saving; the UI falls back to per-item thumbnails
  // until this populates.
  previewImage: {
    url:         { type: String, default: '' },
    publicId:    { type: String, default: '' },
    generatedAt: { type: Date,   default: null },
  },
}, { timestamps: true });

wardrobeComboSchema.index({ user: 1, createdAt: -1 });
wardrobeComboSchema.index(
  { user: 1, sourceRecommendationId: 1, sourceCategory: 1 },
  { sparse: true }
);

module.exports = mongoose.model('WardrobeCombo', wardrobeComboSchema);
