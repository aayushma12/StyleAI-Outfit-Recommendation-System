'use strict';

// ── Recommendation pipeline orchestrator (v2 — deterministic) ──────────────
// This file used to build one giant prompt and ask an LLM to invent an outfit
// end-to-end, scoring it cosmetically afterwards. It is now a thin conductor:
//
//   contextEngine → candidateGenerationService → rankingService
//     → diversityEngine → (template explanation, always present)
//
// No LLM call is required to produce a complete, ranked, explained session.
// (The original single-LLM-call implementation was kept temporarily as
// recommendationEngineLegacy.js during the v2 rollout and has since been
// removed now that the deterministic pipeline is validated.)

const Recommendation             = require('../models/Recommendation');
const contextEngine              = require('./contextEngine');
const candidateGenerationService = require('./candidateGenerationService');
const rankingService             = require('./rankingService');
const diversityEngine            = require('./diversityEngine');
const explanationService         = require('./explanationService');
const scoring                    = require('./scoringService');
const weatherService             = require('./weatherService');

const ALL_OUTFIT_SLOTS = [
  'top', 'bottom', 'dress', 'outerwear', 'footwear',
  'accessory', 'jewelry', 'bag', 'belt', 'watch', 'scarf', 'sunglasses', 'hair_accessory',
];

function emptySlotShape() {
  return { item: null, name: '', suggestion: '', reason: '', suggestedItem: null };
}

function buildOutfitName(catMeta, outfitItems) {
  if (!outfitItems.length) return `${catMeta.label} Look`;
  const primary = outfitItems.find(it => ['tops', 'dresses', 'traditional'].includes(it.category)) || outfitItems[0];
  return `${catMeta.label}: ${primary.name}`.slice(0, 80);
}

function buildTips(context) {
  const tips = [];
  const layering = context.weather?.temp != null
    ? require('./fashionRulesEngine').getWeatherLayeringAdvice(context.weather.temp)
    : null;
  if (layering?.requireOuterwear) tips.push(`Kathmandu's ${layering.tier} weather today means outerwear isn't optional — ${layering.fabrics} work best.`);
  else if (layering?.recommendOuterwear) tips.push(`A light layer is worth carrying — mornings/evenings can turn cool.`);
  if (context.festivals?.current?.length) {
    const f = context.festivals.current[0];
    tips.push(`${f.name} is happening this month: ${f.note}`);
  }
  return tips.slice(0, 3);
}

// Shared by buildRankedFromScored (the shown pick) and buildAlternate (stored
// runner-ups) — kept in one place rather than duplicated across both.
function scoresFromBreakdown(breakdown) {
  const scores = {
    styleMatch:      breakdown['Style Match'],
    colorHarmony:    breakdown['Color Harmony'],
    colorPreference: breakdown['Color Preference'],
    occasionFit:     breakdown['Occasion Fit'],
    weatherFit:      breakdown['Weather Fit'],
    behaviorSignal:  breakdown['Behavior Match'],
    bodyTypeMatch:   breakdown['Body Type Match'],
    fabricMatch:     breakdown['Fabric Match'],
    trendScore:      breakdown['Trend Score'],
  };
  // Wizard-only — only present in breakdown for wizard sessions where the
  // corresponding field carried real signal (see scoringService.js).
  if (breakdown['Dresscode Fit']      !== undefined) scores.dresscodeFit     = breakdown['Dresscode Fit'];
  if (breakdown['Indoor/Outdoor Fit'] !== undefined) scores.indoorOutdoorFit = breakdown['Indoor/Outdoor Fit'];
  if (breakdown['Day/Night Fit']      !== undefined) scores.dayNightFit      = breakdown['Day/Night Fit'];
  if (breakdown['Vibe Match']         !== undefined) scores.vibeMatch        = breakdown['Vibe Match'];
  if (breakdown['Budget Fit']         !== undefined) scores.budgetFit        = breakdown['Budget Fit'];
  return scores;
}

function buildRankedFromScored(catMeta, scored, rank, explanation, explanationSource, context, alternates = []) {
  const outfit = {};
  ALL_OUTFIT_SLOTS.forEach(slot => { outfit[slot] = scored.candidate.slots[slot] || emptySlotShape(); });

  return {
    category:      catMeta.key,
    categoryLabel: catMeta.label,
    categoryEmoji: catMeta.emoji,
    categoryBrief: catMeta.brief,
    rank,
    confidence: scored.confidence,
    ruleScore: scored.ruleScore ?? null,
    scores: scoresFromBreakdown(scored.breakdown),
    outfitName: buildOutfitName(catMeta, scored.outfitItems),
    outfit,
    stylingNotes: { colorCombination: '', layeringAdvice: '', hairstyleSuggestion: '', makeupNote: '', overallLook: '' },
    explanation,
    colorHarmony: explanation.colorReason    || '',
    occasionFit:  explanation.occasionReason || '',
    weatherNote:  explanation.weatherReason  || '',
    styleInsight: explanation.styleReason    || '',
    tips: buildTips(context),
    status: 'pending',
    mlAcceptanceProbability: scored.mlAcceptanceProbability,
    explanationSource,
    generationMethod: 'deterministic_v2',
    // Bounded runner-up pool (top 2, computed once here — never regenerated)
    // that submitFeedback can swap in when this category's shown pick gets
    // disliked. See recommendationController.submitFeedback.
    alternates,
  };
}

// Builds the small "runner-up" pool used for same-session adaptive
// re-ranking (Recommendation.rankedRecommendationSchema.alternates). Reuses
// the exact candidates rankingService already scored — no regeneration, no
// extra ML/candidate-generation cost. Capped at 2 per category.
const MAX_ALTERNATES_PER_CATEGORY = 2;

function buildAlternates(rankedPerCategory, selected, user, context) {
  const byCategory = {};
  for (const { catMeta, scored } of selected) {
    const pool = rankedPerCategory[catMeta.key] || [];
    const selectedFingerprint = scoring.fingerprintOutfit(scored.candidate.slots);
    const runnerUps = pool
      .filter(p => scoring.fingerprintOutfit(p.candidate.slots) !== selectedFingerprint)
      .slice(0, MAX_ALTERNATES_PER_CATEGORY);

    byCategory[catMeta.key] = runnerUps.map(p => {
      const outfit = {};
      ALL_OUTFIT_SLOTS.forEach(slot => { outfit[slot] = p.candidate.slots[slot] || emptySlotShape(); });
      return {
        confidence: p.confidence,
        scores: scoresFromBreakdown(p.breakdown),
        outfitName: buildOutfitName(catMeta, p.outfitItems),
        outfit,
        explanation: explanationService.buildTemplateExplanation(p, catMeta.key, user, context),
      };
    });
  }
  return byCategory;
}

async function runPipeline(user, options, categories, candidateOverrides = {}, wizardParams = {}) {
  const context = await contextEngine.buildContext(user, options);

  const candidates = candidateGenerationService.generateCandidates(user, context.wardrobeItems, {
    occasion: context.occasion,
    weather:  context.weather,
    season:   context.season?.seasonKey,
    allowSuggestions: context.allowSuggestions,
    styleHint: context.styleHint,
    catalogItems: context.catalogItems,
    ...candidateOverrides,
  });

  const ranked      = await rankingService.rankForCategories(candidates, user, context, categories, wizardParams);
  const selected    = diversityEngine.selectDiverse(ranked, categories, context);
  const alternates  = buildAlternates(ranked, selected, user, context);
  const explained   = await explanationService.explainSession(selected, user, context);
  const recs        = explained.map(({ catMeta, scored, rank, explanation, explanationSource }) =>
    buildRankedFromScored(catMeta, scored, rank, explanation, explanationSource, context, alternates[catMeta.key] || [])
  );
  const deduped     = scoring.deduplicateRecommendations(recs);

  return { context, candidates, deduped };
}

function sessionCommonFields(context) {
  return {
    behaviorSnapshot: {
      topColors:         context.insights.topColors?.slice(0, 5)     || [],
      topCategories:     context.insights.topCategories?.slice(0, 4) || [],
      topOccasions:      context.insights.topOccasions?.slice(0, 3)  || [],
      acceptanceRate:    context.insights.recommendationStats?.acceptRate ?? null,
      totalInteractions: context.insights.totalInteractions || 0,
    },
    kathmanduContext: {
      season:         context.season.season,
      activeFestival: context.festivals.primaryFestival?.name || '',
      fashionNote:    context.season.climate,
    },
  };
}

// ── Standard session generation ───────────────────────────────────────────────

exports.generateSession = async (user, options = {}) => {
  const {
    occasion = 'daily', mood = '', wardrobeOnly = false,
    requestedBy = 'user', upcomingEvent = null, recentOutfitSummaries = [],
  } = options;

  const categories = scoring.RECOMMENDATION_CATEGORIES;
  const { context, candidates, deduped } = await runPipeline(
    user, { occasion, mood, wardrobeOnly, requestedBy, upcomingEvent, recentOutfitSummaries }, categories
  );

  const session = await Recommendation.create({
    user: user._id,
    context: {
      occasion, mood, wardrobeOnly, requestedBy,
      weather:   context.weather.temp !== null ? context.weather : undefined,
      season:    context.season.season,
      timeOfDay: context.tod,
    },
    calendarEventContext: context.upcomingEvent ? {
      hasEvent:   true,
      eventType:  context.upcomingEvent.type || context.upcomingEvent.occasion || '',
      eventDate:  context.upcomingEvent.date,
      eventNotes: context.upcomingEvent.notes || '',
      hoursAway:  context.upcomingEvent.hoursAway || null,
    } : { hasEvent: false },
    ...sessionCommonFields(context),
    collaborativeContext: {
      peerCount:       context.cfData.peerCount       || 0,
      sharedStyles:    context.cfData.sharedStyles    || [],
      sharedOccasions: context.cfData.sharedOccasions || [],
      signal:          context.cfData.signal          || null,
    },
    recommendations: deduped,
    generationMeta: {
      candidatePoolSize: candidates.length,
      diversityMethod:   'mmr_jaccard_v1',
      pipelineVersion:   'v2',
    },
    status: 'complete',
  });

  return Recommendation.populateAndSanitize(Recommendation.findById(session._id));
};

// ── Wizard session generation ─────────────────────────────────────────────────

const WIZARD_CATEGORIES = [
  { key: 'wizard_option_1', label: 'Classic Pick', emoji: '⭐', brief: 'Timeless, elegant approach' },
  { key: 'wizard_option_2', label: 'Modern Edge',  emoji: '✨', brief: 'Contemporary, fashion-forward' },
  { key: 'wizard_option_3', label: 'Local Fusion', emoji: '🌸', brief: 'Nepali tradition meets modern style' },
];

exports.generateWizardSession = async (user, wizardParams = {}) => {
  const { occasion = 'daily', style = '', extraNotes = '' } = wizardParams;

  // Wizard is a premium styling session — not wardrobe-constrained — but its
  // style answer should still shape which real wardrobe items (and which
  // generic suggestions) get favoured.
  const candidateOverrides = {
    allowSuggestions: true,
    styleHint: style || undefined,
  };

  const { context, candidates, deduped } = await runPipeline(
    user, { occasion, requestedBy: 'wizard', allowSuggestions: true }, WIZARD_CATEGORIES, candidateOverrides
  );

  const session = await Recommendation.create({
    user: user._id,
    context: {
      occasion, requestedBy: 'wizard',
      weather: context.weather.temp !== null ? context.weather : undefined,
      season:  context.season.season, timeOfDay: context.tod,
    },
    wizardContext: { occasion, style, extraNotes },
    ...sessionCommonFields(context),
    recommendations: deduped,
    generationMeta: {
      candidatePoolSize: candidates.length,
      diversityMethod:   'mmr_jaccard_v1',
      pipelineVersion:   'v2',
    },
    status: 'complete',
  });

  return Recommendation.populateAndSanitize(Recommendation.findById(session._id));
};

// ── Query helpers ─────────────────────────────────────────────────────────────

exports.getLatestSession = async (userId) => {
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  return Recommendation.populateAndSanitize(
    Recommendation.findOne({ user: userId, status: 'complete', createdAt: { $gte: sixHoursAgo } }).sort({ createdAt: -1 })
  );
};

exports.getHistory = async (userId, { page = 1, limit = 8 } = {}) => {
  const skip = (page - 1) * limit;
  const [docs, total] = await Promise.all([
    Recommendation.populateAndSanitize(
      Recommendation.find({ user: userId, status: 'complete' }).sort({ createdAt: -1 }).skip(skip).limit(limit)
    ),
    Recommendation.countDocuments({ user: userId, status: 'complete' }),
  ]);
  return { sessions: docs, total, page, pages: Math.ceil(total / limit) };
};

exports.getSessionById = async (userId, sessionId) =>
  Recommendation.populateAndSanitize(Recommendation.findOne({ _id: sessionId, user: userId }));

// Re-exported for existing callers (dailyRecommendationService, recommendationController).
exports.fetchWeather             = weatherService.fetchWeather;
exports.getUpcomingCalendarEvent = contextEngine.getUpcomingCalendarEvent;
exports.getRecentOutfitSummaries = contextEngine.getRecentOutfitSummaries;
exports.WIZARD_CATEGORIES        = WIZARD_CATEGORIES;
