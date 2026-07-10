'use strict';
const mongoose = require('mongoose');

const wardrobeItemSchema = new mongoose.Schema({
  user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:     { type: String, required: true, trim: true, maxlength: 100 },
  category: {
    type: String,
    required: true,
    enum: ['tops', 'bottoms', 'dresses', 'jackets', 'footwear', 'accessories', 'traditional'],
  },
  color:    { type: String, required: true, trim: true },
  occasion: { type: String, trim: true, default: '' },
  season:   { type: String, trim: true, default: '' },
  brand:    { type: String, trim: true, maxlength: 60, default: '' },
  size:     { type: String, trim: true, maxlength: 20, default: '' },
  pattern:  {
    type: String,
    trim: true,
    enum: ['solid', 'striped', 'plaid', 'floral', 'geometric', 'abstract', 'animal_print', 'paisley', 'checkered', 'embroidered', 'other', ''],
    default: '',
  },
  material:      { type: String, trim: true, maxlength: 60, default: '' },
  price:         { type: Number, min: 0, default: null },
  purchaseDate:  { type: Date, default: null },
  imageUrl:  { type: String, trim: true, default: '' },
  publicId:  { type: String, trim: true, default: '' },
  notes:     { type: String, trim: true, maxlength: 300, default: '' },

  /* ── AI/CV-extracted structured metadata (all additive — legacy items simply
        have these at their defaults and fall back to keyword inference) ────── */
  subcategory: { type: String, trim: true, maxlength: 60, default: '' }, // e.g. "blouse", "hoop earrings"
  colorHex:    [{ type: String, trim: true }], // dominant → secondary, e.g. ['#1a1a2e', '#e94560']
  fit: {
    type: String, trim: true,
    enum: ['fitted', 'regular', 'relaxed', 'oversized', 'cropped', ''],
    default: '',
  },
  formalityLevel: { type: Number, min: 0, max: 4, default: null }, // maps to fashionRulesEngine.OCCASION_META scale
  layeringLevel: {
    type: String, trim: true,
    enum: ['base', 'mid', 'outer', 'one_piece', ''],
    default: '',
  },
  sleeveLength: {
    type: String, trim: true,
    enum: ['sleeveless', 'short', '3/4', 'long', ''],
    default: '',
  },
  suitableSeasons:   [{ type: String, enum: ['winter', 'spring', 'monsoon', 'autumn', 'all'] }],
  suitableOccasions: [{ type: String, trim: true }],
  styleTags: [{
    type: String,
    enum: ['minimalist', 'streetwear', 'smart_casual', 'korean', 'vintage',
           'preppy', 'athleisure', 'romantic', 'edgy', 'boho', 'classic',
           'grunge', 'cottagecore', 'y2k', 'modest_chic'],
  }],
  accessoryCompatibility: [{ type: String, trim: true }], // slot names this item pairs well with
  materialGuess: { type: String, trim: true, maxlength: 60, default: '' }, // AI guess, distinct from user-entered `material`
  neckline: {
    type: String, trim: true,
    enum: ['crew', 'round', 'v_neck', 'polo_collar', 'shirt_collar', 'turtleneck', 'high_neck', 'square_neck', 'off_shoulder', 'boat_neck', ''],
    default: '',
  },
  genderCategory: {
    type: String, trim: true,
    enum: ['women', 'men', 'unisex', ''],
    default: '',
  },
  details: {
    hasHood:       { type: Boolean, default: false },
    hasButtons:    { type: Boolean, default: false },
    hasZipper:     { type: Boolean, default: false },
    hasPockets:    { type: Boolean, default: false },
    hasLogo:       { type: Boolean, default: false },
    hasBelt:       { type: Boolean, default: false },
    isTransparent: { type: Boolean, default: false },
  },

  aiMeta: {
    extractedAt: { type: Date, default: null },
    provider: {
      type: String,
      enum: ['gemini', 'color-only', 'manual', ''],
      default: '',
    },
    fieldConfidence: { type: mongoose.Schema.Types.Mixed, default: {} }, // per-field 0-1
    visionAvailable: { type: Boolean, default: true },
  },
  unverifiedFields: [{ type: String }], // AI-set fields awaiting user confirmation
  metadataReviewed: { type: Boolean, default: true }, // false only for freshly AI-tagged, unreviewed items
}, { timestamps: true });

wardrobeItemSchema.index({ user: 1, category: 1 });
wardrobeItemSchema.index({ user: 1, createdAt: -1 });
wardrobeItemSchema.index({ user: 1, occasion: 1 });

module.exports = mongoose.model('WardrobeItem', wardrobeItemSchema);
