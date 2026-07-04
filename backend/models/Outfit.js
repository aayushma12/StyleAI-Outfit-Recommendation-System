'use strict';
const mongoose = require('mongoose');

const outfitSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 600, default: '' },
  category: {
    type: String,
    required: true,
    enum: ['tops', 'bottoms', 'dresses', 'outerwear', 'footwear', 'accessories', 'traditional', 'full_outfit'],
  },
  style:     [{ type: String, trim: true }],
  occasion:  [{ type: String, trim: true }],
  season:    [{ type: String, trim: true }],
  colors:    [{ type: String, trim: true }],
  fabric:    { type: String, trim: true, default: '' },
  brand:     { type: String, trim: true, default: '' },
  price:     { type: Number, min: 0, default: null },
  imageUrl:  { type: String, trim: true, default: '' },
  publicId:  { type: String, trim: true, default: '' },
  tags:      [{ type: String, trim: true }],
  isApproved: { type: Boolean, default: true },
  isActive:   { type: Boolean, default: true },
  popularity: { type: Number, default: 0, min: 0 },
  addedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

outfitSchema.index({ category: 1, isActive: 1 });
outfitSchema.index({ occasion: 1, isActive: 1 });
outfitSchema.index({ season: 1, isActive: 1 });
outfitSchema.index({ style: 1 });
outfitSchema.index({ popularity: -1 });
outfitSchema.index({ isApproved: 1, isActive: 1 });

module.exports = mongoose.model('Outfit', outfitSchema);
