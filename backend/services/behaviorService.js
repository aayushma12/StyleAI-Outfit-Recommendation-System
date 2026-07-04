'use strict';

const BehaviorLog = require('../models/BehaviorLog');

// ── Temporal decay ────────────────────────────────────────────────────────────
// Exponential decay with ~14-day half-life. Recent interactions dominate;
// 60-day-old events contribute essentially nothing.
const DECAY_RATE = 0.05;

function decayWeight(createdAt) {
  const daysAgo = (Date.now() - new Date(createdAt).getTime()) / 86400000;
  return Math.exp(-DECAY_RATE * Math.max(0, daysAgo));
}

// Positive actions used for "what the user likes"
const POSITIVE_ACTIONS = new Set([
  'recommendation_accept', 'recommendation_save', 'outfit_like',
  'outfit_save', 'wardrobe_add',
]);

// Negative actions used for "what the user dislikes"
const NEGATIVE_ACTIONS = new Set([
  'recommendation_reject',
]);

// ── Log a single behavioral event ────────────────────────────────────────────

exports.logBehavior = async (userId, action, opts = {}) => {
  try {
    await BehaviorLog.create({
      user:       userId,
      action,
      entityId:   opts.entityId   || undefined,
      entityType: opts.entityType || undefined,
      metadata:   opts.metadata   || {},
    });
  } catch (err) {
    // Never crash the main request on logging failure
    console.error('[behaviorService] logBehavior error:', err.message);
  }
};

// ── Positive behavioral insights (temporally weighted) ───────────────────────

exports.getUserInsights = async (userId) => {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);

  const [allLogs, recommendationStats] = await Promise.all([
    BehaviorLog.find({ user: userId, createdAt: { $gte: ninetyDaysAgo } })
      .sort({ createdAt: -1 })
      .select('action metadata createdAt')
      .lean(),
    BehaviorLog.aggregate([
      {
        $match: {
          user:   userId,
          action: { $in: ['recommendation_accept', 'recommendation_reject', 'recommendation_save'] },
        },
      },
      { $group: { _id: '$action', count: { $sum: 1 } } },
    ]),
  ]);

  // Weighted frequency maps for colors, categories, occasions
  const colorWeights    = {};
  const categoryWeights = {};
  const occasionWeights = {};
  const styleWeights    = {};

  for (const log of allLogs) {
    if (!POSITIVE_ACTIONS.has(log.action)) continue;
    const w = decayWeight(log.createdAt);
    const m = log.metadata || {};

    [].concat(m.color    || []).forEach(c => { colorWeights[c]    = (colorWeights[c]    || 0) + w; });
    [].concat(m.category || []).forEach(c => { categoryWeights[c] = (categoryWeights[c] || 0) + w; });
    if (m.occasion) { occasionWeights[m.occasion] = (occasionWeights[m.occasion] || 0) + w; }
    if (m.style)    { styleWeights[m.style]        = (styleWeights[m.style]       || 0) + w; }
  }

  const sortDesc = obj =>
    Object.entries(obj)
      .sort(([, a], [, b]) => b - a)
      .map(([k]) => k);

  const recStats = { accepted: 0, rejected: 0, saved: 0 };
  recommendationStats.forEach(r => {
    if (r._id === 'recommendation_accept') recStats.accepted = r.count;
    if (r._id === 'recommendation_reject') recStats.rejected = r.count;
    if (r._id === 'recommendation_save')   recStats.saved    = r.count;
  });
  const totalRec   = recStats.accepted + recStats.rejected + recStats.saved;
  const acceptRate = totalRec > 0
    ? Math.round(((recStats.accepted + recStats.saved) / totalRec) * 100)
    : null;

  const sevenDaysAgo  = new Date(Date.now() - 7 * 86400000);
  const recentColors = [...new Set(
    allLogs
      .filter(a => new Date(a.createdAt) > sevenDaysAgo && a.metadata?.color && POSITIVE_ACTIONS.has(a.action))
      .flatMap(a => [].concat(a.metadata.color).filter(Boolean))
  )];

  return {
    topColors:     sortDesc(colorWeights).slice(0, 8),
    topCategories: sortDesc(categoryWeights).slice(0, 6),
    topOccasions:  sortDesc(occasionWeights).slice(0, 5),
    topStyles:     sortDesc(styleWeights).slice(0, 6),
    recentColors,
    totalInteractions:   allLogs.length,
    recommendationStats: { ...recStats, acceptRate, total: totalRec },
    hasHistory:          allLogs.length > 5,
  };
};

// ── Negative signal aggregation ───────────────────────────────────────────────
// Collects attributes of outfits the user explicitly rejected or skipped,
// weighted by recency. Used to populate the "AVOID" section of LLM prompts.

// When a user explicitly picks a dislike reason (DislikeReasonModal.jsx),
// that specific dimension's avoidance signal is boosted for that log — an
// explicit "it was the wrong color" is stronger evidence than an unexplained
// rejection that merely happened to use that color.
const REASON_BOOST = 1.5;

exports.getNegativeSignals = async (userId) => {
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000);

  const rejectLogs = await BehaviorLog.find({
    user:   userId,
    action: { $in: [...NEGATIVE_ACTIONS] },
    createdAt: { $gte: sixtyDaysAgo },
  }).select('metadata createdAt').lean();

  const avoidColors     = {};
  const avoidCategories = {};
  const avoidStyles     = {};
  const avoidOccasions  = {};

  for (const log of rejectLogs) {
    const w = decayWeight(log.createdAt);
    const m = log.metadata || {};
    const reasons = m.reasons || [];

    const wColor    = reasons.includes('wrong_color')    ? w * REASON_BOOST : w;
    const wStyle    = reasons.includes('wrong_style')    ? w * REASON_BOOST : w;
    const wOccasion = reasons.includes('wrong_occasion') ? w * REASON_BOOST : w;

    // metadata may have arrays (from multi-item logging) or single values
    const colors     = [].concat(m.color     || []);
    const categories = [].concat(m.category  || []);
    const styles     = [].concat(m.style     || []);
    const occasions  = [].concat(m.occasion  || []);

    colors.forEach(c     => { avoidColors[c]     = (avoidColors[c]     || 0) + wColor; });
    categories.forEach(c => { avoidCategories[c] = (avoidCategories[c] || 0) + w; });
    styles.forEach(s     => { avoidStyles[s]      = (avoidStyles[s]     || 0) + wStyle; });
    occasions.forEach(o  => { avoidOccasions[o]   = (avoidOccasions[o] || 0) + wOccasion; });
  }

  // Only surface signals with enough weight to matter (> 0.5 = at least 1 recent rejection)
  const threshold = 0.5;
  const filter    = (obj) =>
    Object.entries(obj)
      .filter(([, w]) => w > threshold)
      .sort(([, a], [, b]) => b - a)
      .map(([k]) => k);

  return {
    avoidColors:     filter(avoidColors).slice(0, 6),
    avoidCategories: filter(avoidCategories).slice(0, 4),
    avoidStyles:     filter(avoidStyles).slice(0, 5),
    avoidOccasions:  filter(avoidOccasions).slice(0, 3),
    hasNegativeHistory: rejectLogs.length > 0,
    rejectCount:        rejectLogs.length,
  };
};

// ── Style evolution analysis ──────────────────────────────────────────────────
// Detects whether the user's preferences are shifting over time.
// Compares recent 2-week window vs prior 6-week window.

exports.getStyleEvolution = async (userId) => {
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000);
  const eightWeeksAgo = new Date(Date.now() - 56 * 86400000);

  const [recentLogs, priorLogs] = await Promise.all([
    BehaviorLog.find({ user: userId, action: { $in: [...POSITIVE_ACTIONS] }, createdAt: { $gte: twoWeeksAgo } })
      .select('metadata').lean(),
    BehaviorLog.find({ user: userId, action: { $in: [...POSITIVE_ACTIONS] }, createdAt: { $gte: eightWeeksAgo, $lt: twoWeeksAgo } })
      .select('metadata').lean(),
  ]);

  const countMap = (logs, field) => {
    const m = {};
    logs.forEach(l => {
      [].concat(l.metadata?.[field] || []).filter(Boolean).forEach(v => { m[v] = (m[v] || 0) + 1; });
    });
    return m;
  };

  const recentColors = countMap(recentLogs, 'color');
  const priorColors  = countMap(priorLogs,  'color');

  // Find colors accelerating in popularity (appeared more recently)
  const trending = Object.keys(recentColors)
    .filter(c => (recentColors[c] || 0) > (priorColors[c] || 0))
    .sort((a, b) => (recentColors[b] - (priorColors[b] || 0)) - (recentColors[a] - (priorColors[a] || 0)))
    .slice(0, 3);

  const recentStyles = countMap(recentLogs, 'style');
  const priorStyles  = countMap(priorLogs,  'style');
  const trendingStyles = Object.keys(recentStyles)
    .filter(s => (recentStyles[s] || 0) > (priorStyles[s] || 0))
    .sort((a, b) => (recentStyles[b] - (priorStyles[b] || 0)) - (recentStyles[a] - (priorStyles[a] || 0)))
    .slice(0, 3);

  return { trendingColors: trending, trendingStyles, hasEvolution: trending.length > 0 || trendingStyles.length > 0 };
};

// ── Wardrobe activity mapping ─────────────────────────────────────────────────
// Returns item IDs that have appeared in recommendation feedback events recently.
// Used to surface wardrobe items that haven't been recommended in a while.

exports.getRecentlyRecommendedItemIds = async (userId, days = 30) => {
  const since = new Date(Date.now() - days * 86400000);
  const logs  = await BehaviorLog.find({
    user:   userId,
    action: 'recommendation_accept',
    'metadata.itemIds': { $exists: true, $ne: [] },
    createdAt: { $gte: since },
  }).select('metadata.itemIds').lean();

  const ids = new Set();
  logs.forEach(l => (l.metadata?.itemIds || []).forEach(id => ids.add(id.toString())));
  return ids;
};
