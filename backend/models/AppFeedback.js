const mongoose = require('mongoose');

const appFeedbackSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['suggestion', 'complaint', 'improvement'],
    required: true,
  },
  subject: { type: String, trim: true, maxlength: 120 },
  message: { type: String, required: true, trim: true, maxlength: 1000 },
  recommendationRating: { type: Number, min: 1, max: 5 },
  satisfactionRating:   { type: Number, min: 1, max: 5 },
  wouldRecommend:       { type: Boolean },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'resolved'],
    default: 'pending',
  },
  isPublic: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('AppFeedback', appFeedbackSchema);
