'use strict';

const mongoose = require('mongoose');

// Shared by Recommendation (rankedRecommendationSchema.explanation) and
// WardrobeCombo (aiExplanation) so a saved AI outfit can carry the exact
// explanation it was generated with, without duplicating the field list.
module.exports = new mongoose.Schema({
  summary:        { type: String, default: '' },
  styleReason:    { type: String, default: '' },
  colorReason:    { type: String, default: '' },
  occasionReason: { type: String, default: '' },
  weatherReason:  { type: String, default: '' },
  behaviorReason: { type: String, default: '' },
  wardrobeReason: { type: String, default: '' },
  calendarReason: { type: String, default: '' },
}, { _id: false });
