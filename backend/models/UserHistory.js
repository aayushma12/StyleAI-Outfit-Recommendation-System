const mongoose = require('mongoose');

const userHistorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  action: {
    type: String,
    required: true,
    enum: [
      'wardrobe_added', 'wardrobe_updated', 'wardrobe_removed',
      'outfit_created', 'outfit_updated', 'outfit_deleted',
      'calendar_scheduled', 'calendar_updated', 'calendar_removed',
      'ai_interaction', 'feedback_submitted', 'general',
    ],
  },
  category: {
    type: String,
    enum: ['wardrobe', 'outfit', 'calendar', 'ai', 'feedback', 'general'],
    required: true,
  },
  title:       { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  metadata: {
    itemName:     String,
    itemImage:    String,
    itemCategory: String,
    outfitName:   String,
    color:        String,
    score:        Number,
    occasion:     String,
    season:       String,
    date:         String,
    count:        Number,
  },
  refId: { type: mongoose.Schema.Types.ObjectId, default: null },
}, { timestamps: true });

userHistorySchema.index({ user: 1, createdAt: -1 });
userHistorySchema.index({ user: 1, category: 1, createdAt: -1 });
userHistorySchema.index({ user: 1, action: 1 });

module.exports = mongoose.model('UserHistory', userHistorySchema);
