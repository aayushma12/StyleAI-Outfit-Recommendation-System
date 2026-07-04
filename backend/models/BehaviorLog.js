'use strict';

const mongoose = require('mongoose');

/**
 * BehaviorLog — records every meaningful user interaction.
 * Used by the recommendation engine to personalise suggestions over time
 * without asking the user the same questions repeatedly.
 */
const behaviorLogSchema = new mongoose.Schema({
  user: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
    index:    true,
  },

  action: {
    type:     String,
    required: true,
    enum: [
      /* Wardrobe */
      'wardrobe_add', 'wardrobe_delete', 'wardrobe_view',
      /* Outfit combos */
      'outfit_save', 'outfit_delete', 'outfit_like', 'outfit_dislike',
      /* Calendar */
      'outfit_calendar_add', 'outfit_calendar_remove',
      /* AI recommendations */
      'recommendation_view', 'recommendation_accept',
      'recommendation_reject', 'recommendation_save',
      /* AI chat */
      'ai_chat',
      /* Other */
      'feedback_submit', 'profile_update', 'style_search',
    ],
  },

  /* Reference to the entity being acted on */
  entityId:   { type: mongoose.Schema.Types.ObjectId },
  entityType: { type: String }, // 'WardrobeItem' | 'WardrobeCombo' | 'Recommendation' | etc.

  /* Lightweight metadata extracted at log-time for fast aggregation.
     color and category accept either a single String or an Array of Strings
     (recommendation_reject logs store arrays from multi-item outfits). */
  metadata: {
    color:    mongoose.Schema.Types.Mixed, // String | [String]
    category: mongoose.Schema.Types.Mixed, // String | [String]
    occasion: String,
    season:   String,
    style:    String,
    score:    Number,
    tags:     [String],
    accepted: Boolean,
    itemIds:  [{ type: mongoose.Schema.Types.ObjectId }],
    reasons:  [String],
  },
}, {
  timestamps: true,
  // Logs are append-only — skip version key to save a write per log
  versionKey: false,
});

/* Indexes for insight aggregation queries */
behaviorLogSchema.index({ user: 1, action: 1, createdAt: -1 });
behaviorLogSchema.index({ user: 1, 'metadata.category': 1 });
behaviorLogSchema.index({ user: 1, 'metadata.color': 1 });
/* TTL — automatically expire behavior logs after 1 year (logs older than
   365 days contribute no meaningful behavioral signal after decay) */
behaviorLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 3600 });

module.exports = mongoose.model('BehaviorLog', behaviorLogSchema);
