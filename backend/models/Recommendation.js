'use strict';

const mongoose = require('mongoose');
const explanationSchema = require('./schemas/explanationSchema');

// ── Shared sub-schemas ────────────────────────────────────────────────────────

const outfitSlotSchema = new mongoose.Schema({
  item:       { type: mongoose.Schema.Types.ObjectId, ref: 'WardrobeItem', default: null },
  name:       { type: String, default: '' },
  suggestion: { type: String, default: '' },
  reason:     { type: String, default: '' },
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
const POPULATE_PATHS = [
  'recommendations.outfit.top.item',
  'recommendations.outfit.bottom.item',
  'recommendations.outfit.dress.item',
  'recommendations.outfit.outerwear.item',
  'recommendations.outfit.footwear.item',
  'recommendations.outfit.accessory.item',
  'recommendations.outfit.jewelry.item',
  'recommendations.outfit.bag.item',
  'recommendations.outfit.belt.item',
  'recommendations.outfit.watch.item',
  'recommendations.outfit.scarf.item',
  'recommendations.outfit.sunglasses.item',
  'recommendations.outfit.hair_accessory.item',
];

recommendationSessionSchema.statics.populateItems = function(query) {
  let q = query;
  POPULATE_PATHS.forEach(path => { q = q.populate(path, 'name color category imageUrl occasion'); });
  return q;
};

module.exports = mongoose.model('Recommendation', recommendationSessionSchema);
