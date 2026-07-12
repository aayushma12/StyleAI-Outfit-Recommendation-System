'use strict';

const mongoose = require('mongoose');
const explanationSchema = require('./schemas/explanationSchema');

// ── Shared sub-schemas ────────────────────────────────────────────────────────

const outfitSlotSchema = new mongoose.Schema({
  item:          { type: mongoose.Schema.Types.ObjectId, ref: 'WardrobeItem', default: null },
  name:          { type: String, default: '' },
  suggestion:    { type: String, default: '' },
  reason:        { type: String, default: '' },
  // A real catalog product suggested to fill a gap the wardrobe doesn't cover —
  // distinct from `suggestion` (generic fallback text with no real product behind it).
  suggestedItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Outfit', default: null },
}, { _id: false });

const scoreBreakdownSchema = new mongoose.Schema({
  styleMatch:      { type: Number, default: 70 },
  colorHarmony:    { type: Number, default: 70 },
  colorPreference: { type: Number, default: 70 },
  occasionFit:     { type: Number, default: 70 },
  weatherFit:      { type: Number, default: 70 },
  behaviorSignal:  { type: Number, default: 70 },
  bodyTypeMatch:   { type: Number, default: 70 },
  fabricMatch:     { type: Number, default: 70 },
  trendScore:      { type: Number, default: 55 },
  // Wizard-only dimensions — null for every standard (non-wizard) session,
  // populated only when the recommendation wizard supplied real signal for
  // the corresponding field (see scoringService.js's computeSubScores).
  dresscodeFit:     { type: Number, default: null },
  indoorOutdoorFit: { type: Number, default: null },
  dayNightFit:      { type: Number, default: null },
  vibeMatch:        { type: Number, default: null },
  budgetFit:        { type: Number, default: null },
}, { _id: false });

// ── Per-recommendation item ───────────────────────────────────────────────────

const rankedRecommendationSchema = new mongoose.Schema({
  category:      { type: String, required: true },
  categoryLabel: { type: String, default: '' },
  categoryEmoji: { type: String, default: '✨' },
  categoryBrief: { type: String, default: '' },
  rank:          { type: Number, default: 1 },

  confidence:    { type: Number, default: 75, min: 0, max: 100 },
  scores:        { type: scoreBreakdownSchema, default: () => ({}) },

  outfitName: { type: String, default: 'Styled Outfit' },

  // Core clothing slots
  outfit: {
    top:       { type: outfitSlotSchema, default: () => ({}) },
    bottom:    { type: outfitSlotSchema, default: () => ({}) },
    dress:     { type: outfitSlotSchema, default: () => ({}) },
    outerwear: { type: outfitSlotSchema, default: () => ({}) },
    footwear:  { type: outfitSlotSchema, default: () => ({}) },
    // Accessory expansion — now covers the full outfit picture
    accessory:      { type: outfitSlotSchema, default: () => ({}) },
    jewelry:        { type: outfitSlotSchema, default: () => ({}) },
    bag:            { type: outfitSlotSchema, default: () => ({}) },
    belt:           { type: outfitSlotSchema, default: () => ({}) },
    watch:          { type: outfitSlotSchema, default: () => ({}) },
    scarf:          { type: outfitSlotSchema, default: () => ({}) },
    sunglasses:     { type: outfitSlotSchema, default: () => ({}) },
    hair_accessory: { type: outfitSlotSchema, default: () => ({}) },
  },

  // Full styling notes for premium/event recommendations
  stylingNotes: {
    colorCombination: { type: String, default: '' },
    layeringAdvice:   { type: String, default: '' },
    hairstyleSuggestion: { type: String, default: '' },
    makeupNote:       { type: String, default: '' },
    overallLook:      { type: String, default: '' },
  },

  explanation:  { type: explanationSchema, default: () => ({}) },
  colorHarmony: { type: String, default: '' },
  occasionFit:  { type: String, default: '' },
  weatherNote:  { type: String, default: '' },
  styleInsight: { type: String, default: '' },
  tips:         [{ type: String }],

  status: {
    type:    String,
    enum:    ['pending', 'worn', 'saved', 'liked', 'disliked', 'skipped'],
    default: 'pending',
  },
  userRating:      { type: Number, min: 1, max: 5, default: null },
  userFeedback:    { type: String, default: '', maxlength: 400 },
  feedbackReasons: [{ type: String }],

  // ── Deterministic pipeline metadata (additive — older sessions simply lack
  //    these fields and are displayed without the "AI-polished"/ML badges) ──
  mlAcceptanceProbability: { type: Number, default: null, min: 0, max: 1 },
  explanationSource: { type: String, enum: ['template', 'llm_polished'], default: 'template' },
  generationMethod:  { type: String, enum: ['deterministic_v2', 'legacy_llm_v1'], default: 'deterministic_v2' },

  // Standalone rule-based score (0-1), before any ML acceptance-probability
  // blend — see scoringService.finalizeScore. Closes the one real gap in an
  // otherwise-already-complete recommendation log (user, timestamp, wizard
  // params, weather, candidate count, ML probability, final score, feedback
  // reason were all already persisted).
  ruleScore: { type: Number, default: null, min: 0, max: 1 },

  // Bounded runner-up pool (top 2, computed once at generation time from
  // candidates rankingService already scored — never regenerated) used for
  // same-session adaptive re-ranking when this category's shown pick gets
  // disliked. See recommendationController.submitFeedback. Mixed because an
  // alternate mirrors a subset of this same schema's shape (confidence,
  // scores, outfitName, outfit, explanation) but isn't itself a full ranked
  // recommendation (no status/feedback of its own until promoted).
  alternates: [{ type: mongoose.Schema.Types.Mixed }],
}, { _id: true, timestamps: false });

// ── Recommendation session ────────────────────────────────────────────────────

const recommendationSessionSchema = new mongoose.Schema({
  user: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
    index:    true,
  },

  context: {
    occasion:     { type: String, default: 'daily' },
    mood:         { type: String, default: '' },
    wardrobeOnly: { type: Boolean, default: false },
    weather: {
      temp:      Number,
      feelsLike: Number,
      humidity:  Number,
      windSpeed: Number,
      rainProb:  Number,
      condition: String,
      code:      Number,
    },
    season:      { type: String, default: '' },
    timeOfDay:   { type: String, enum: ['morning', 'afternoon', 'evening', 'night'], default: 'morning' },
    requestedBy: {
      type:    String,
      enum:    ['daily', 'user', 'ai_chat', 'calendar', 'wizard'],
      default: 'user',
    },
  },

  // Upcoming calendar event that influenced this recommendation
  calendarEventContext: {
    hasEvent:   { type: Boolean, default: false },
    eventType:  { type: String, default: '' },
    eventDate:  { type: Date,   default: null },
    eventNotes: { type: String, default: '' },
    hoursAway:  { type: Number, default: null },
  },

  // Wizard parameters when requestedBy = 'wizard'
  wizardContext: {
    occasion:      { type: String, default: '' },
    dresscode:     { type: String, default: '' },
    budget:        { type: String, default: '' },
    indoorOutdoor: { type: String, default: '' },
    dayNight:      { type: String, default: '' },
    style:         { type: String, default: '' },
    vibe:          { type: String, default: '' },
    accessories:   { type: Boolean, default: true },
    luxuryBudget:  { type: Boolean, default: false },
    extraNotes:    { type: String, default: '' },
  },

  behaviorSnapshot: {
    topColors:         [String],
    topCategories:     [String],
    topOccasions:      [String],
    acceptanceRate:    { type: Number, default: null },
    totalInteractions: { type: Number, default: 0 },
  },

  recommendations: [rankedRecommendationSchema],

  kathmanduContext: {
    season:         { type: String, default: '' },
    activeFestival: { type: String, default: '' },
    fashionNote:    { type: String, default: '' },
  },

  collaborativeContext: {
    peerCount:       { type: Number, default: 0 },
    sharedStyles:    [{ type: String }],
    sharedOccasions: [{ type: String }],
    signal:          { type: Number, default: null },
  },

  rawAiResponse: { type: String, select: false },

  generationMeta: {
    candidatePoolSize: { type: Number, default: null },
    diversityMethod:   { type: String, default: '' },
    pipelineVersion:   { type: String, default: 'v2' },
  },

  status: {
    type:    String,
    enum:    ['generating', 'complete', 'failed'],
    default: 'complete',
  },

  // ── Synthetic-data provenance (additive) ──────────────────────────────────
  // Explicit, honest marker distinguishing generated training/demo data from
  // real user sessions — previously the ONLY way to tell was which user ID a
  // document belonged to, which broke the moment more than one synthetic
  // user existed (see scripts/seedPersonaSyntheticBehavior.js).
  synthetic: { type: Boolean, default: false, index: true },
  syntheticMeta: {
    generator:        { type: String, default: '' },
    personaId:        { type: String, default: '' },
    personaArchetype: { type: String, default: '' },
    simulatedDate:    { type: Date, default: null },
  },

}, { timestamps: true });

// ── Indexes ───────────────────────────────────────────────────────────────────
recommendationSessionSchema.index({ user: 1, createdAt: -1 });
recommendationSessionSchema.index({ user: 1, status: 1 });
recommendationSessionSchema.index({ user: 1, 'context.occasion': 1 });
recommendationSessionSchema.index({ user: 1, 'context.requestedBy': 1, createdAt: -1 });

// ── Population helper ─────────────────────────────────────────────────────────
const OUTFIT_SLOTS = [
  'top', 'bottom', 'dress', 'outerwear', 'footwear',
  'accessory', 'jewelry', 'bag', 'belt', 'watch', 'scarf', 'sunglasses', 'hair_accessory',
];
const POPULATE_PATHS = OUTFIT_SLOTS.map(slot => `recommendations.outfit.${slot}.item`);
const SUGGESTED_ITEM_PATHS = OUTFIT_SLOTS.map(slot => `recommendations.outfit.${slot}.suggestedItem`);

recommendationSessionSchema.statics.populateItems = function(query) {
  let q = query;
  POPULATE_PATHS.forEach(path => { q = q.populate(path, 'name color category imageUrl occasion'); });
  // No `price` — the recommendation workflow helps users decide what to
  // wear, not what to buy, so financial information is never returned here.
  SUGGESTED_ITEM_PATHS.forEach(path => { q = q.populate(path, 'name imageUrl imageVerified category brand occasion colors'); });
  return q;
};

// Strips imageUrl from any suggestedItem that hasn't been human-verified to
// actually depict this item (see Outfit.imageVerified) — enforced here, once,
// so every caller gets the guarantee automatically rather than relying on
// each frontend render path to check the flag correctly.
function sanitizeUnverifiedImages(doc) {
  if (!doc) return doc;
  if (Array.isArray(doc)) return doc.map(sanitizeUnverifiedImages);
  for (const rec of doc.recommendations || []) {
    for (const slot of Object.values(rec.outfit || {})) {
      if (slot?.suggestedItem && !slot.suggestedItem.imageVerified) slot.suggestedItem.imageUrl = '';
    }
  }
  return doc;
}

recommendationSessionSchema.statics.populateAndSanitize = async function(query) {
  return sanitizeUnverifiedImages(await this.populateItems(query).lean());
};

module.exports = mongoose.model('Recommendation', recommendationSessionSchema);
