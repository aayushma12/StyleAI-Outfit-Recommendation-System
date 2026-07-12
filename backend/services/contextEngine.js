'use strict';

// ── Recommendation context assembly ─────────────────────────────────────────
// Single place that gathers everything the pipeline needs before candidate
// generation/scoring can run: wardrobe, weather, season/festivals, behavioral
// insights, negative signals, collaborative signal, calendar event, and
// recent-outfit history (for cross-session diversity). Reused identically by
// standard, wizard, and daily recommendation sessions — previously this logic
// was duplicated/inline inside recommendationEngine.js's generateSession.

const WardrobeItem   = require('../models/WardrobeItem');
const WardrobeCombo  = require('../models/WardrobeCombo');
const OutfitCalendar = require('../models/OutfitCalendar');
const Recommendation = require('../models/Recommendation');
const Outfit         = require('../models/Outfit');
const { getUserInsights, getNegativeSignals, getStyleEvolution, getRecentlyRecommendedItemIds } = require('./behaviorService');
const kathmandu      = require('./kathmanduIntelligence');
const collaborative  = require('./collaborativeService');
const weatherService = require('./weatherService');
const scoring        = require('./scoringService');
const { generateWardrobeUtilizationReport, getPredictiveInsights } = require('./personalizedLearningService');

// A session generated today should never repeat a full outfit shown in the
// last few days — regardless of whether the user ever gave feedback on it.
// This is deliberately independent from getRecentlyRecommendedItemIds()
// (item-level, accept-gated, 14-day window): that one models "don't
// re-suggest what I recently wore/liked", this one models "don't show me
// the exact same outfit I was just shown".
const RECENTLY_SERVED_WINDOW_DAYS = 3;

// ── Small pure helpers (moved from recommendationEngine.js, unchanged) ─────

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

function getTimeOfDayNote(tod) {
  return {
    morning:   'Getting dressed for the day — practical, polished, and weather-appropriate.',
    afternoon: 'Midday context — outfit should carry through the rest of the day comfortably.',
    evening:   'Evening context — consider elevated styling, dinner-ready or event-appropriate looks.',
    night:     'Night context — social events, parties, or a relaxed end-of-day look.',
  }[tod] || '';
}

function groupByCategory(items) {
  return items.reduce((acc, it) => {
    const cat = it.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(it);
    return acc;
  }, {});
}

function buildProfileSection(user) {
  return [
    user.age               && `Age: ${user.age}`,
    user.gender            && `Gender: ${user.gender}`,
    user.occupation        && `Occupation: ${user.occupation}`,
    user.bodyType          && `Body type: ${user.bodyType.replace(/_/g, ' ')}`,
    user.skinTone          && `Skin tone: ${user.skinTone}`,
    user.clothingFit       && `Preferred fit: ${user.clothingFit}`,
    user.modestyLevel      && `Modesty: ${user.modestyLevel}`,
    user.lifestyle         && `Lifestyle: ${user.lifestyle.replace(/_/g, ' ')}`,
    user.fashionConfidence && `Fashion confidence: ${user.fashionConfidence}/5`,
    user.comfortPriority   && `Comfort priority: ${user.comfortPriority}/5`,
    user.layeringPreference && `Layering preference: ${user.layeringPreference}`,
    ([...(user.stylePreferences || []), ...(user.fashionStyles || [])].length > 0) &&
      `Style preferences: ${[...(user.stylePreferences || []), ...(user.fashionStyles || [])].join(', ')}`,
    user.colorPreferences?.length    && `Favourite colors: ${user.colorPreferences.join(', ')}`,
    user.dislikedColors?.length      && `Disliked colors (NEVER include): ${user.dislikedColors.join(', ')}`,
    user.occasionPreferences?.length && `Frequent occasions: ${user.occasionPreferences.join(', ')}`,
    user.accessoryStyle              && `Accessory style: ${user.accessoryStyle}`,
    user.footwearPreferences?.length && `Footwear preferences: ${user.footwearPreferences.join(', ')}`,
    user.budgetRange?.max            && `Budget range: NPR ${user.budgetRange.min || 0}–${user.budgetRange.max}`,
    user.additionalStyleNotes        && `Style notes: ${user.additionalStyleNotes}`,
  ].filter(Boolean).join('\n') || 'Minimal profile — use general fashion principles for young women in Kathmandu.';
}

async function getRecentOutfitSummaries(userId, days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const sessions = await Recommendation.find(
    { user: userId, createdAt: { $gte: since }, status: 'complete' },
    { 'recommendations.outfit': 1, 'recommendations.outfitName': 1,
      'recommendations.category': 1, createdAt: 1 }
  ).sort({ createdAt: -1 }).lean();

  return sessions.flatMap(s =>
    (s.recommendations || [])
      .filter(r => r.category === 'best_match' || r.category === 'most_stylish')
      .map(r => {
        const items = Object.values(r.outfit || {}).map(slot => slot.name).filter(Boolean).join(', ');
        return items ? `"${r.outfitName}" (${items})` : null;
      })
      .filter(Boolean)
  ).slice(0, 10);
}

async function getRecentlyServedFingerprints(userId, days = RECENTLY_SERVED_WINDOW_DAYS) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const sessions = await Recommendation.find(
    { user: userId, createdAt: { $gte: since } },
    { 'recommendations.outfit': 1 }
  ).lean();

  const fingerprints = new Set();
  sessions.forEach(s => {
    (s.recommendations || []).forEach(r => {
      const fp = scoring.fingerprintOutfit(r.outfit);
      if (fp) fingerprints.add(fp);
    });
  });
  return fingerprints;
}

async function getUpcomingCalendarEvent(userId, hoursAhead = 48) {
  const now = new Date();
  const limit = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  const events = await OutfitCalendar.find({ user: userId, date: { $gte: now, $lte: limit } }).sort({ date: 1 }).lean();
  if (!events.length) return null;
  const ev = events[0];
  const hoursAway = Math.round((new Date(ev.date) - now) / (60 * 60 * 1000));
  return { ...ev, hoursAway };
}

// ── Main entry point ─────────────────────────────────────────────────────────

/**
 * Gathers everything the deterministic pipeline needs to generate, score, and
 * rank outfit candidates for one session. Called once per session by
 * recommendationEngine.js (standard, wizard, and daily paths alike).
 */
exports.buildContext = async function buildContext(user, options = {}) {
  const {
    occasion = 'daily', mood = '', wardrobeOnly = false,
    requestedBy = 'user', upcomingEvent: providedEvent = null,
    recentOutfitSummaries: providedSummaries = null,
    allowSuggestions,
  } = options;

  const [
    wardrobeItems, recentSaved, insights, weather, cfData,
    negativeSignals, styleEvolution, upcomingEvent, recentOutfitSummaries,
    recentlyRecommendedItemIds, recentlyServedFingerprints, catalogItems,
  ] = await Promise.all([
    WardrobeItem.find({ user: user._id }).lean(),
    WardrobeCombo.find({ user: user._id }).sort({ createdAt: -1 }).limit(10).select('name occasion').lean(),
    getUserInsights(user._id),
    weatherService.fetchWeather(),
    collaborative.getCollaborativeData(user._id, user.occasionPreferences || []).catch(() => ({})),
    getNegativeSignals(user._id).catch(() => ({})),
    getStyleEvolution(user._id).catch(() => ({})),
    providedEvent !== null ? Promise.resolve(providedEvent) : getUpcomingCalendarEvent(user._id, 48),
    providedSummaries !== null ? Promise.resolve(providedSummaries) : getRecentOutfitSummaries(user._id, 7),
    getRecentlyRecommendedItemIds(user._id, 14).catch(() => []),
    getRecentlyServedFingerprints(user._id).catch(() => new Set()),
    // Real catalog products eligible to fill a wardrobe gap as a "Suggested
    // Addition" — never 'full_outfit' (not a per-slot concept here).
    Outfit.find({
      isActive: true, isApproved: true,
      category: { $in: ['tops', 'bottoms', 'dresses', 'outerwear', 'footwear', 'accessories', 'traditional'] },
    }).limit(100).lean().catch(() => []),
  ]);

  collaborative.refreshSimilarUsers(user._id, user).catch(() => {});

  // kathmandu.getActiveFestivals will become DB-first/async in a later phase —
  // awaiting a synchronous return value today is harmless and future-proofs this call site.
  const [season, festivals] = await Promise.all([
    Promise.resolve(kathmandu.getSeasonIntelligence()),
    Promise.resolve(kathmandu.getActiveFestivals()),
  ]);

  const grouped = groupByCategory(wardrobeItems);
  const tod     = getTimeOfDay();

  const [utilizationReport, predictiveInsights] = await Promise.all([
    generateWardrobeUtilizationReport(user._id).catch(() => ({ underusedItems: [] })),
    getPredictiveInsights(user._id, weather).catch(() => []),
  ]);

  const cfInsights = cfData.sharedStyles?.length ? cfData : null;
  const styleHint  = kathmandu.requiresTraditionalConsideration(occasion) ? 'traditional' : '';

  return {
    occasion, mood, wardrobeOnly, requestedBy, tod, styleHint,
    wardrobeItems, grouped, recentSaved,
    weather, season, festivals,
    insights, negativeSignals, styleEvolution,
    cfData, cfInsights,
    upcomingEvent, recentOutfitSummaries, recentlyRecommendedItemIds,
    recentlyServedFingerprints,
    utilizationReport, predictiveInsights, catalogItems,
    allowSuggestions: allowSuggestions !== undefined ? allowSuggestions : !wardrobeOnly,
  };
};

exports.groupByCategory          = groupByCategory;
exports.buildProfileSection      = buildProfileSection;
exports.getTimeOfDay             = getTimeOfDay;
exports.getTimeOfDayNote         = getTimeOfDayNote;
exports.getRecentOutfitSummaries = getRecentOutfitSummaries;
exports.getUpcomingCalendarEvent = getUpcomingCalendarEvent;
exports.getRecentlyServedFingerprints = getRecentlyServedFingerprints;
