const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
  action:   { type: String, required: true },
  category: { type: String, enum: ['auth', 'users', 'wardrobe', 'feedback', 'system'], default: 'system' },
  detail:   { type: String, default: '' },
}, { timestamps: true });

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
