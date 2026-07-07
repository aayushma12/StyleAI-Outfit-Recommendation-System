const mongoose = require('mongoose');

const evaluationResponseSchema = new mongoose.Schema({
  participantLabel:      { type: String, trim: true, maxlength: 80 },
  recommendationQuality: { type: Number, required: true, min: 1, max: 5 },
  easeOfUse:              { type: Number, required: true, min: 1, max: 5 },
  visualDesign:           { type: Number, required: true, min: 1, max: 5 },
  systemSpeed:            { type: Number, required: true, min: 1, max: 5 },
  overallSatisfaction:    { type: Number, required: true, min: 1, max: 5 },
  comments:               { type: String, trim: true, maxlength: 1000 },
}, { timestamps: true });

module.exports = mongoose.model('EvaluationResponse', evaluationResponseSchema);
