'use strict';

/**
 * personalizedLearningService.js
 *
 * Higher-order intelligence layer that synthesises behavioral signals,
 * wardrobe data, and contextual information into:
 *   - Wardrobe utilization analysis (underused items)
 *   - Predictive fashion intelligence (festival alerts, weather prep)
 *   - AI calibration score (genuine measure of learning quality)
 *   - Style narrative (plain-English user profile summary for XAI)
 */

const WardrobeItem   = require('../models/WardrobeItem');
const Recommendation = require('../models/Recommendation');
const BehaviorLog    = require('../models/BehaviorLog');
const kathmandu      = require('./kathmanduIntelligence');

// ── Wardrobe utilization analysis ────────────────────────────────────────────

/**
 * Analyses the wardrobe against recent recommendation sessions to identify:
 * - Overused items (recommended in 3+ sessions this month)
 * - Underused items (not recommended in 30+ days, or never)
 * - Underrepresented categories
 */
exports.generateWardrobeUtilizationReport = async (userId) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);

  const [wardrobeItems, recentSessions] = await Promise.all([
    WardrobeItem.find({ user: userId }).lean(),
    Recommendation.find({
      user:      userId,
      status:    'complete',
      createdAt: { $gte: ninetyDaysAgo },
    }, { recommendations: 1, createdAt: 1 }).lean(),
  ]);

  if (wardrobeItems.length === 0) {
    return {
      totalItems: 0, utilizationRate: 0,
      underusedItems: [], overusedItems: [],
      categoryGaps: [], suggestions: [],
    };
  }

  // Build item → recommendation count mapping
  const itemUsageCount    = {};
  const itemLastUsed      = {};

  recentSessions.forEach(session => {
    const sessionDate = new Date(session.createdAt);
    (session.recommendations || []).forEach(rec => {
      const outfit = rec.outfit || {};
      Object.values(outfit).forEach(slot => {
        if (slot?.item) {
          const id = slot.item.toString();
          itemUsageCount[id] = (itemUsageCount[id] || 0) + 1;
          if (!itemLastUsed[id] || sessionDate > itemLastUsed[id]) {
            itemLastUsed[id] = sessionDate;
          }
        }
      });
    });
  });

  const usedItemIds      = new Set(Object.keys(itemUsageCount));
  const totalItems       = wardrobeItems.length;
  const usedItemCount    = wardrobeItems.filter(it => usedItemIds.has(it._id.toString())).length;
  const utilizationRate  = totalItems > 0 ? Math.round((usedItemCount / totalItems) * 100) : 0;

  // Underused: items not seen in any session in 30+ days (or never)
  const underusedItems = wardrobeItems
    .filter(it => {
      const id       = it._id.toString();
      const lastUsed = itemLastUsed[id];
      return !lastUsed || lastUsed < thirtyDaysAgo;
    })
    .sort((a, b) => {
      const lastA = itemLastUsed[a._id.toString()] || new Date(0);
      const lastB = itemLastUsed[b._id.toString()] || new Date(0);
      return lastA - lastB; // oldest first
    })
    .slice(0, 8)
    .map(it => ({
      id:       it._id,
      name:     it.name,
      category: it.category,
      color:    it.color,
      daysSinceUsed: itemLastUsed[it._id.toString()]
        ? Math.floor((Date.now() - new Date(itemLastUsed[it._id.toString()]).getTime()) / 86400000)
        : null,
    }));

  // Overused: items recommended in 5+ sessions in 90 days — risk of repetition fatigue
  const overusedItems = wardrobeItems
    .filter(it => (itemUsageCount[it._id.toString()] || 0) >= 5)
    .map(it => ({
      id:        it._id,
      name:      it.name,
      category:  it.category,
      usageCount: itemUsageCount[it._id.toString()],
    }))
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, 5);

  // Category gap analysis — check for missing core categories
  const ownedCategories = new Set(wardrobeItems.map(it => it.category));
  const CORE_CATEGORIES = ['tops', 'bottoms', 'footwear'];
  const categoryGaps    = CORE_CATEGORIES.filter(c => !ownedCategories.has(c));

  // Generate utilization suggestions
  const suggestions = [];
  if (underusedItems.length > 3) {
    suggestions.push({
      type: 'underused',
      title: `${underusedItems.length} wardrobe items haven't been recommended recently`,
      detail: `Items like "${underusedItems[0]?.name}" haven't appeared in outfit suggestions for a while. The AI will prioritise these in upcoming recommendations.`,
      action: 'generate',
    });
  }
  if (overusedItems.length > 0) {
    suggestions.push({
      type: 'overused',
      title: `"${overusedItems[0]?.name}" is being suggested too frequently`,
      detail: 'Some items are appearing in almost every recommendation. Add more variety to your wardrobe to improve recommendation diversity.',
      action: 'wardrobe',
    });
  }
  if (categoryGaps.length > 0) {
    suggestions.push({
      type: 'gap',
      title: `Missing wardrobe categories: ${categoryGaps.join(', ')}`,
      detail: 'Adding items in these categories will significantly improve the AI\'s ability to build complete outfit recommendations.',
      action: 'wardrobe',
    });
  }

  return {
    totalItems,
    utilizationRate,
    underusedItems,
    overusedItems,
    categoryGaps,
    suggestions,
    reportDate: new Date(),
  };
};

// ── Predictive fashion intelligence ──────────────────────────────────────────

/**
 * Returns proactive, context-aware fashion intelligence:
 * festival preparation, weather warnings.
 */
exports.getPredictiveInsights = async (userId, weather = {}) => {
  const insights = [];
  const festivals = await kathmandu.getActiveFestivals();

  // Festival preparation alerts
  if (festivals.current.length > 0) {
    const major = festivals.current.filter(f => f.type === 'major' || f.traditional);
    if (major.length > 0) {
      const f = major[0];
      insights.push({
        type:     'festival',
        urgency:  'high',
        icon:     '🎉',
        title:    `${f.name} — Now Active`,
        detail:   f.note,
        action:   'generate',
        occasion: 'festival',
      });
    }
  }

  if (festivals.upcoming.length > 0) {
    const major = festivals.upcoming.filter(f => f.traditional);
    if (major.length > 0) {
      insights.push({
        type:    'festival',
        urgency: 'medium',
        icon:    '📅',
        title:   `Prepare for ${major[0].name.replace('Coming next month: ', '')}`,
        detail:  'This festival is coming next month. The AI can help you plan your traditional outfit now.',
        action:  'wizard',
        occasion: 'festival',
      });
    }
  }

  // Weather-based predictive intelligence
  if (weather.rainProb > 60) {
    insights.push({
      type:    'weather',
      urgency: 'high',
      icon:    '☔',
      title:   'High Rain Probability Today',
      detail:  `${weather.rainProb}% chance of rain in Kathmandu. Prioritise water-resistant footwear and avoid suede or delicate fabrics.`,
      action:  'generate',
      occasion: 'daily',
    });
  }

  if (weather.temp !== null && weather.temp < 10) {
    insights.push({
      type:    'weather',
      urgency: 'high',
      icon:    '🥶',
      title:   `It's Cold — ${weather.temp}°C in Kathmandu`,
      detail:  'Temperatures are below 10°C. Today\'s outfit must include warm layering. Recommend checking your winter wardrobe.',
      action:  'generate',
      occasion: 'daily',
    });
  }

  if (weather.temp !== null && weather.temp > 32) {
    insights.push({
      type:    'weather',
      urgency: 'medium',
      icon:    '☀️',
      title:   `Heat Warning — ${weather.temp}°C`,
      detail:  'Very warm day ahead. Choose breathable cotton or linen. Avoid heavy or dark fabrics.',
      action:  'generate',
      occasion: 'daily',
    });
  }

  // Seasonal transition alerts
  const month = new Date().getMonth() + 1;
  const transitionAdvice = {
    3:  { icon: '🌸', title: 'Spring is Arriving', detail: 'Transition from heavy woolens to light layers. This is a great time to refresh your wardrobe for the new season.' },
    6:  { icon: '🌧️', title: 'Monsoon Season Begins', detail: 'Kathmandu\'s monsoon is starting. Update your wardrobe with quick-dry fabrics and waterproof footwear for the next 3 months.' },
    10: { icon: '🍁', title: 'Autumn — Best Fashion Season', detail: 'October is Kathmandu\'s best weather month. Perfect conditions for any style. Festival season (Dashain + Tihar) calls for your best outfits.' },
    12: { icon: '❄️', title: 'Winter is Approaching', detail: 'Check your winter wardrobe now. Ensure you have adequate warm layers, coats, and boots for Kathmandu\'s chilly season.' },
  };

  if (transitionAdvice[month]) {
    insights.push({
      type:    'seasonal',
      urgency: 'low',
      ...transitionAdvice[month],
      action:  'wardrobe',
    });
  }

  return insights.slice(0, 6);
};

// ── AI calibration score ─────────────────────────────────────────────────────

/**
 * Computes a genuine measure of AI learning quality — not a proxy for data richness.
 * Formula considers:
 *   - Acceptance rate over last 30 sessions (how often user likes recommendations)
 *   - Improvement trend (is acceptance rate increasing over time?)
 *   - Profile completeness (richer profile = better starting point)
 *   - Behavioral diversity (more varied interactions = more signal)
 */
exports.computeCalibrationScore = async (userId, profileCompleteness = 50) => {
  const thirtyDaysAgo  = new Date(Date.now() - 30 * 86400000);
  const sixtyDaysAgo   = new Date(Date.now() - 60 * 86400000);

  const [recentStats, priorStats, totalInteractions] = await Promise.all([
    BehaviorLog.aggregate([
      { $match: { user: userId, action: { $in: ['recommendation_accept','recommendation_reject','recommendation_save'] }, createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: '$action', count: { $sum: 1 } } },
    ]),
    BehaviorLog.aggregate([
      { $match: { user: userId, action: { $in: ['recommendation_accept','recommendation_reject','recommendation_save'] }, createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } } },
      { $group: { _id: '$action', count: { $sum: 1 } } },
    ]),
    BehaviorLog.countDocuments({ user: userId }),
  ]);

  const toStats = (arr) => {
    const s = { accepted: 0, rejected: 0, saved: 0 };
    arr.forEach(r => {
      if (r._id === 'recommendation_accept') s.accepted = r.count;
      if (r._id === 'recommendation_reject') s.rejected = r.count;
      if (r._id === 'recommendation_save')   s.saved    = r.count;
    });
    const total = s.accepted + s.rejected + s.saved;
    return { ...s, total, rate: total > 0 ? (s.accepted + s.saved) / total : null };
  };

  const recent = toStats(recentStats);
  const prior  = toStats(priorStats);

  // Base score from recent acceptance rate
  let score = recent.rate !== null ? recent.rate * 50 : 25;

  // Improvement trend bonus — was the AI improving?
  if (recent.rate !== null && prior.rate !== null) {
    const improvement = recent.rate - prior.rate;
    score += Math.max(-10, Math.min(15, improvement * 30));
  }

  // Profile richness contribution
  score += (profileCompleteness / 100) * 20;

  // Interaction diversity bonus (more interactions = more learning signal)
  score += Math.min(15, Math.log10(Math.max(1, totalInteractions)) * 8);

  return {
    calibrationScore: Math.round(Math.max(0, Math.min(100, score))),
    recentAcceptanceRate: recent.rate !== null ? Math.round(recent.rate * 100) : null,
    priorAcceptanceRate:  prior.rate  !== null ? Math.round(prior.rate  * 100) : null,
    isImproving: recent.rate !== null && prior.rate !== null && recent.rate > prior.rate,
    totalInteractions,
    interpretation: score >= 70 ? 'Well-calibrated — the AI has learned your style well'
      : score >= 45 ? 'Learning — the AI is gathering preference data'
      : 'Early stage — more interactions will significantly improve accuracy',
  };
};

// ── Style narrative ───────────────────────────────────────────────────────────

/**
 * Generates a short, plain-English narrative about the user's inferred style
 * based on behavioral signals. Used for the InsightsPanel and XAI explanations.
 */
exports.generateStyleNarrative = (insights, negativeSignals) => {
  const phrases = [];

  if (insights.topColors?.length > 0) {
    const cols = insights.topColors.slice(0, 3).join(', ');
    phrases.push(`gravitates towards ${cols} tones`);
  }

  if (insights.topStyles?.length > 0) {
    const styles = insights.topStyles.slice(0, 2).join(' and ');
    phrases.push(`prefers a ${styles} aesthetic`);
  }

  if (insights.topCategories?.length > 0) {
    phrases.push(`frequently wears ${insights.topCategories.slice(0,2).join(' and ')}`);
  }

  if (insights.topOccasions?.length > 0) {
    phrases.push(`most often dresses for ${insights.topOccasions[0]} occasions`);
  }

  if (negativeSignals?.avoidColors?.length > 0) {
    phrases.push(`tends to avoid ${negativeSignals.avoidColors.slice(0,2).join(' and ')} colours`);
  }

  if (phrases.length === 0) return 'Still learning your style — rate a few outfits to get started.';

  return `Based on your interactions, you ${phrases.join(', and ')}.`;
};
