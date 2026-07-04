const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role:    { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  // Links an outfit-intent reply back to the deterministic recommendation
  // session it was actually built from (the ID was already computed and
  // returned in the API response — this just persists it on the message too).
  recommendationSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Recommendation', default: null },
  // Lexical grounding check on freehand replies (see groundingService.js) —
  // flags phrases that look like a reference to an owned wardrobe item the
  // user doesn't actually have. A heuristic, not a hallucination-detection
  // guarantee — see groundingService.js's own documented limitations.
  groundingFlag:   { type: Boolean, default: false },
  flaggedPhrases:  [{ type: String }],
}, { timestamps: true });

const aiConversationSchema = new mongoose.Schema({
  user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title:        { type: String, default: 'New Chat', maxlength: 100 },
  messages:     [messageSchema],
  lastActivity: { type: Date, default: Date.now },
}, { timestamps: true });

aiConversationSchema.index({ user: 1, lastActivity: -1 });

module.exports = mongoose.model('AIConversation', aiConversationSchema);
