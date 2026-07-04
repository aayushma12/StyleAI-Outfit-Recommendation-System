'use strict';

const engine                   = require('../services/recommendationEngine');
const dailySvc                 = require('../services/dailyRecommendationService');
const { logBehavior,
        getUserInsights,
        getNegativeSignals }    = require('../services/behaviorService');
const { generateWardrobeUtilizationReport,
        getPredictiveInsights,
        computeCalibrationScore,
        generateStyleNarrative } = require('../services/personalizedLearningService');
const { CATEGORY_WEIGHTS }     = require('../services/scoringService');
const ki                       = require('../services/kathmanduIntelligence');
const popularity               = require('../services/popularityService');
const Recommendation           = require('../models/Recommendation');
const WardrobeItem             = require('../models/WardrobeItem');
const WardrobeCombo            = require('../models/WardrobeCombo');
const User                     = require('../models/User');

// ── Daily recommendation ──────────────────────────────────────────────────────

/**
 * GET /recommendations/daily
 * Returns today's personalized outfit recommendation, generating it if needed.
 * This is the endpoint the Dashboard calls on every load — no user action required.
 */
exports.getDaily = async (req, res) => {
  const result = await dailySvc.getOrGenerateDaily(req.user._id);

  logBehavior(req.user._id, 'recommendation_view', {
    entityId:   result.session?._id,
    entityType: 'Recommendation',
    metadata:   { occasion: 'daily', isNew: result.isNew },
  });

  res.json({
    session:          result.session,
    isNew:            result.isNew,
    hasCalendarEvent: result.hasCalendarEvent,
    calendarEvent:    result.calendarEvent,
  });
};

/**
 * POST /recommendations/daily/regenerate
 * Explicitly generates a fresh daily outfit, bypassing the same-day cache
 * that GET /daily otherwise serves. Used by the dashboard's "Try another
 * outfit" action.
 */
exports.regenerateDaily = async (req, res) => {
  const result = await dailySvc.regenerateDaily(req.user._id);

  logBehavior(req.user._id, 'recommendation_view', {
    entityId:   result.session?._id,
    entityType: 'Recommendation',
    metadata:   { occasion: 'daily', isNew: true, regenerated: true },
  });

  res.json({
    session:          result.session,
    isNew:            result.isNew,
    hasCalendarEvent: result.hasCalendarEvent,
    calendarEvent:    result.calendarEvent,
  });
};

// ── Standard recommendation ───────────────────────────────────────────────────

exports.getLatest = async (req, res) => {
  const session = await engine.getLatestSession(req.user._id);
  res.json({ session: session || null });
};

exports.generate = async (req, res) => {
  const {
    occasion     = 'daily',
    mood         = '',
    wardrobeOnly = false,
    requestedBy  = 'user',
  } = req.body;

  const user = await User.findById(req.user._id).lean();
  if (!user) return res.status(404).json({ message: 'User not found.' });

  // Fetch dedup data in parallel with generation context
  const recentSummaries = await engine.getRecentOutfitSummaries(req.user._id, 7);

  try {
    const session = await engine.generateSession(user, {
      occasion, mood, wardrobeOnly, requestedBy,
      recentOutfitSummaries: recentSummaries,
    });

    logBehavior(req.user._id, 'recommendation_view', {
      entityId:   session._id,
      entityType: 'Recommendation',
      metadata:   { occasion },
    });

    res.json({ session });
  } catch (err) {
    if (err.isAiError) {
      return res.status(503).json({
        message: 'AI service is temporarily unavailable. Please try again in a moment.',
      });
    }
    throw err;
  }
};

// ── Wizard session ────────────────────────────────────────────────────────────

/**
 * POST /recommendations/wizard
 * Advanced multi-parameter recommendation generator.
 * Accepts 10+ styling parameters and generates 3 complete outfit options.
 */
exports.wizard = async (req, res) => {
  const {
    occasion      = 'formal',
    dresscode     = '',
    budget        = 'mid-range',
    indoorOutdoor = 'indoor',
    dayNight      = 'day',
    style         = '',
    vibe          = '',
    accessories   = true,
    colors        = '',
    extraNotes    = '',
    luxuryBudget  = false,
  } = req.body;

  const user = await User.findById(req.user._id).lean();
  if (!user) return res.status(404).json({ message: 'User not found.' });

  try {
    const session = await engine.generateWizardSession(user, {
      occasion, dresscode, budget, indoorOutdoor, dayNight,
      style, vibe, accessories, colors, extraNotes, luxuryBudget,
    });

    logBehavior(req.user._id, 'recommendation_view', {
      entityId:   session._id,
      entityType: 'Recommendation',
      metadata:   { occasion, requestedBy: 'wizard' },
    });

    res.json({ session });
  } catch (err) {
    if (err.isAiError) {
      return res.status(503).json({
        message: 'AI service is temporarily unavailable. Please try again in a moment.',
      });
    }
    throw err;
  }
};

// ── Query endpoints ───────────────────────────────────────────────────────────

exports.getHistory = async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(20, parseInt(req.query.limit) || 8);
  const result = await engine.getHistory(req.user._id, { page, limit });
  res.json(result);
};

exports.getOne = async (req, res) => {
  const session = await engine.getSessionById(req.user._id, req.params.id);
  if (!session) return res.status(404).json({ message: 'Recommendation session not found.' });
  res.json({ session });
};

// ── Feedback ──────────────────────────────────────────────────────────────────

exports.submitFeedback = async (req, res) => {
  const { category, status, rating, feedback, reasons } = req.body;

  // 'pending' is a valid reset target (the "Undo" action) — the Mongoose
  // schema enum already allows it (Recommendation.js), this list just needs
  // to match.
  const validStatuses = ['pending', 'worn', 'saved', 'liked', 'disliked', 'skipped'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: `Status must be one of: ${validStatuses.join(', ')}` });
  }
  if (!category) {
    return res.status(400).json({ message: 'category is required (e.g. "best_match").' });
  }

  const session = await Recommendation.findOne({ _id: req.params.id, user: req.user._id });
  if (!session) return res.status(404).json({ message: 'Recommendation session not found.' });

  const rec = session.recommendations.find(r => r.category === category);
  if (!rec) return res.status(404).json({ message: `Category "${category}" not found in this session.` });

  const previousStatus = rec.status;

  rec.status       = status;
  rec.userFeedback = (feedback || '').trim().slice(0, 400);
  if (rating >= 1 && rating <= 5) rec.userRating = Math.round(rating);
  if (Array.isArray(reasons)) rec.feedbackReasons = reasons.slice(0, 10);
  await session.save();

  // Saving an AI recommendation must actually create/update the record the
  // Saved Outfits page reads from (WardrobeCombo) — previously this only
  // flipped rec.status in place, so a "saved" outfit never appeared there.
  // Suggestion-only slots (no owned item) can't be persisted as item refs,
  // matching how the manual Outfit Builder flow already only saves owned items.
  if (status === 'saved') {
    const items = Object.values(rec.outfit || {}).map(s => s?.item).filter(Boolean);
    await WardrobeCombo.findOneAndUpdate(
      { user: req.user._id, sourceRecommendationId: session._id, sourceCategory: category },
      {
        $set: {
          name: rec.outfitName,
          items,
          occasion: session.context?.occasion || '',
          season: session.context?.season || '',
          weatherSnapshot: session.context?.weather || {},
          matchScore: rec.confidence,
          aiConfidence: rec.confidence,
          aiExplanation: rec.explanation || {},
          reasons: [rec.explanation?.summary].filter(Boolean),
          source: 'recommendation',
        },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  } else if (previousStatus === 'saved') {
    // Status moved away from 'saved' (e.g. Undo, or re-rating as disliked) —
    // the linked combo should disappear from Saved Outfits too.
    await WardrobeCombo.deleteOne({ user: req.user._id, sourceRecommendationId: session._id, sourceCategory: category });
  }

  const actionMap = {
    worn:     'recommendation_accept',
    liked:    'recommendation_accept',
    saved:    'recommendation_save',
    disliked: 'recommendation_reject',
    skipped:  'recommendation_reject',
  };

  const acceptedStatus = ['worn', 'liked', 'saved'].includes(status);
  const logMetadata = {
    occasion: session.context?.occasion,
    accepted: acceptedStatus,
    score:    rec.confidence,
  };

  // Record which wardrobe items this outfit used so getRecentlyRecommendedItemIds()
  // (cross-session diversity — penalizing recently-recommended combinations) has
  // real data to work with, not an always-empty set.
  if (acceptedStatus) {
    const acceptedItemIds = Object.values(rec.outfit || {}).map(s => s?.item).filter(Boolean);
    if (acceptedItemIds.length > 0) logMetadata.itemIds = acceptedItemIds;
  }

  // For negative feedback: extract outfit item attributes so they become
  // training signal for getNegativeSignals() → LLM LEARNED AVOIDANCES.
  if (['disliked', 'skipped'].includes(status)) {
    const itemIds = Object.values(rec.outfit || {})
      .map(s => s?.item)
      .filter(Boolean);
    if (itemIds.length > 0) {
      const items = await WardrobeItem.find({ _id: { $in: itemIds } }, { color: 1, category: 1 }).lean();
      logMetadata.color    = [...new Set(items.flatMap(it => (it.color || '').split(',').map(c => c.trim()).filter(Boolean)))];
      logMetadata.category = [...new Set(items.map(it => it.category).filter(Boolean))];
    }
    if (Array.isArray(reasons) && reasons.length) logMetadata.reasons = reasons.slice(0, 10);
  }

  logBehavior(req.user._id, actionMap[status] || 'recommendation_view', {
    entityId:   session._id,
    entityType: 'Recommendation',
    metadata:   logMetadata,
  });

  res.json({ updated: { category, status, rating: rec.userRating } });
};

// ── Insights ──────────────────────────────────────────────────────────────────

exports.getInsights = async (req, res) => {
  const [insights, user] = await Promise.all([
    getUserInsights(req.user._id),
    User.findById(req.user._id).lean(),
  ]);

  const profileFields = [
    'age', 'bodyType', 'skinTone', 'stylePreferences', 'colorPreferences',
    'occasionPreferences', 'lifestyle', 'clothingFit', 'modestyLevel',
    'fabricPreferences', 'fashionStyles', 'dislikedColors',
  ];
  const filledFields = profileFields.filter(f => {
    const v = user[f];
    return v !== undefined && v !== null && v !== '' && (!Array.isArray(v) || v.length > 0);
  });
  const profileCompleteness = Math.round((filledFields.length / profileFields.length) * 100);

  const suggestions = [];
  if (!user.bodyType)                  suggestions.push({ icon:'👗', text:'Add your body type to improve outfit fit',               action:'profile' });
  if (!user.skinTone)                  suggestions.push({ icon:'🎨', text:'Set your skin tone for better color suggestions',         action:'profile' });
  if (!user.fabricPreferences?.length) suggestions.push({ icon:'🧵', text:'Add fabric preferences for comfort-based recommendations', action:'profile' });
  if (!user.colorPreferences?.length)  suggestions.push({ icon:'🌈', text:'Add favourite colors for personalized palettes',           action:'profile' });
  if (insights.totalInteractions < 10) suggestions.push({ icon:'👍', text:'Rate more outfits to help StyleAI learn your preferences', action:'recommendations' });
  if (insights.recommendationStats?.total < 5)
    suggestions.push({ icon:'✨', text:'Generate more AI recommendations to improve accuracy', action:'recommendations' });

  const summaryPhrases = [];
  if (insights.topColors?.length > 0)
    summaryPhrases.push(`You tend to prefer ${insights.topColors.slice(0,3).join(', ')} tones.`);
  if (insights.topCategories?.length > 0)
    summaryPhrases.push(`Your wardrobe leans toward ${insights.topCategories.slice(0,2).join(' and ')}.`);
  if (insights.topOccasions?.length > 0)
    summaryPhrases.push(`You most often dress for ${insights.topOccasions[0]}.`);
  if (insights.recommendationStats?.acceptRate !== null && insights.recommendationStats?.total > 0)
    summaryPhrases.push(`You accept ${insights.recommendationStats.acceptRate}% of AI recommendations.`);

  const learningScore = Math.min(100, Math.round(
    profileCompleteness * 0.4 +
    Math.min(100, insights.totalInteractions * 5) * 0.3 +
    Math.min(100, (insights.recommendationStats?.total || 0) * 10) * 0.3
  ));

  res.json({ insights, profileCompleteness, suggestions: suggestions.slice(0, 5), summaryPhrases, learningScore });
};

exports.getStats = async (req, res) => {
  const sessions = await Recommendation.find(
    { user: req.user._id, status: 'complete' },
    { recommendations: 1 }
  ).lean();

  const allRecs = sessions.flatMap(s => s.recommendations || []);
  const counts  = { worn: 0, liked: 0, saved: 0, disliked: 0, skipped: 0, pending: 0 };
  allRecs.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });

  const positive = counts.worn + counts.liked + counts.saved;
  const total    = allRecs.length;

  res.json({
    stats: {
      totalSessions: sessions.length,
      ...counts,
      total,
      acceptanceRate: total > 0 ? Math.round((positive / total) * 100) : 0,
    },
  });
};

exports.getKathmanduContext = async (req, res) => {
  const [festivals, context] = await Promise.all([
    ki.getActiveFestivals(),
    ki.buildKathmanduContext(),
  ]);
  res.json({
    season: ki.getSeasonIntelligence(),
    festivals,
    context,
  });
};

exports.getTrends = async (req, res) => {
  const trends = await popularity.getTrends();
  res.json({ trends });
};

// ── Analytics ─────────────────────────────────────────────────────────────────

/**
 * GET /recommendations/analytics
 * Returns wardrobe utilization, predictive insights, AI calibration score,
 * style narrative, and negative signals summary for the InsightsPanel / admin.
 */
exports.getAnalytics = async (req, res) => {
  const mlBridge = require('../services/mlBridgeService');
  const WardrobeItem = require('../models/WardrobeItem');
  const KathmanduTrend = require('../models/KathmanduTrend');

  const [user, insights, negSig, weather] = await Promise.all([
    User.findById(req.user._id).lean(),
    getUserInsights(req.user._id),
    getNegativeSignals(req.user._id),
    engine.fetchWeather(),
  ]);

  const profileFields = [
    'age', 'bodyType', 'skinTone', 'stylePreferences', 'colorPreferences',
    'occasionPreferences', 'lifestyle', 'clothingFit', 'modestyLevel',
    'fabricPreferences', 'fashionStyles', 'dislikedColors',
  ];
  const filledCount = profileFields.filter(f => {
    const v = user[f];
    return v !== undefined && v !== null && v !== '' && (!Array.isArray(v) || v.length > 0);
  }).length;
  const profileCompleteness = Math.round((filledCount / profileFields.length) * 100);

  const [utilizationReport, predictiveInsights, calibration, modelMetrics, wardrobeTotal, wardrobeAiTagged, lastTrendUpdate] = await Promise.all([
    generateWardrobeUtilizationReport(req.user._id),
    getPredictiveInsights(req.user._id, weather),
    computeCalibrationScore(req.user._id, profileCompleteness),
    mlBridge.getModelMetrics(),
    WardrobeItem.countDocuments({ user: req.user._id }),
    WardrobeItem.countDocuments({ user: req.user._id, 'aiMeta.extractedAt': { $ne: null } }),
    KathmanduTrend.findOne({}).sort('-updatedAt').select('updatedAt').lean(),
  ]);

  const styleNarrative = generateStyleNarrative(insights, negSig);

  res.json({
    wardrobeUtilization: utilizationReport,
    predictiveInsights,
    calibration,
    styleNarrative,
    negativeSignals: negSig,
    modelTransparency: {
      model: modelMetrics,
      wardrobeMetadataCompleteness: wardrobeTotal > 0 ? Math.round((wardrobeAiTagged / wardrobeTotal) * 100) : 0,
      kathmanduTrendsLastUpdated: lastTrendUpdate?.updatedAt || null,
    },
  });
};

// ── Weights (single source of truth for frontend scoring UI) ──────────────────

/**
 * GET /recommendations/weights
 * Serves CATEGORY_WEIGHTS so the XAI panel doesn't need to hardcode them.
 */
exports.getWeights = (req, res) => {
  res.json({ weights: CATEGORY_WEIGHTS });
};

exports.getMlStatus = async (req, res) => {
  const mlBridge = require('../services/mlBridgeService');
  const [health, model] = await Promise.all([
    Promise.resolve(mlBridge.getHealth()),
    mlBridge.getModelMetrics(),
  ]);
  res.json({ ml: health, model });
};
