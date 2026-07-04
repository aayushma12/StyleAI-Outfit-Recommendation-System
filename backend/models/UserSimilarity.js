'use strict';

const mongoose = require('mongoose');

const userSimilaritySchema = new mongoose.Schema({
  baseUser: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
  },
  similarUser: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
  },
  similarityScore:  { type: Number, default: 0, min: 0, max: 1 },
  sharedStyles:     [{ type: String }],
  sharedOccasions:  [{ type: String }],
  lastComputed:     { type: Date, default: Date.now },
}, { timestamps: false, versionKey: false });

userSimilaritySchema.index({ baseUser: 1, similarityScore: -1 });
userSimilaritySchema.index({ baseUser: 1, similarUser: 1 }, { unique: true });

module.exports = mongoose.model('UserSimilarity', userSimilaritySchema);
