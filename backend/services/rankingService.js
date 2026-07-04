'use strict';

// ── Deterministic ranking ────────────────────────────────────────────────────
// Scores every candidate once (category-independent), makes ONE batched ML
// call for the whole session, then ranks the same candidate pool separately
// per category weight vector. This — not an LLM — is what decides which
// outfits are "best".

const scoring  = require('./scoringService');
const mlBridge = require('./mlBridgeService');
const rules    = require('./fashionRulesEngine');

function resolveOutfitItems(slots, itemsById) {
  return Object.values(slots)
    .filter(s => s.item)
    .map(s => itemsById.get(String(s.item)))
    .filter(Boolean);
}

/**
 * @param {Array}  candidates - output of candidateGenerationService.generateCandidates
 * @param {object} user
 * @param {object} context    - output of contextEngine.buildContext
 * @param {Array}  categories - scoring.RECOMMENDATION_CATEGORIES or WIZARD_CATEGORIES
 * @returns {Promise<object>} - { [categoryKey]: [{candidate, outfitItems, subScores, mlAcceptanceProbability, confidence, breakdown}, ...] } sorted descending by confidence
 */
exports.rankForCategories = async function rankForCategories(candidates, user, context, categories) {
  const itemsById = new Map((context.wardrobeItems || []).map(it => [String(it._id), it]));

  // 1. Sub-scores — computed once per candidate, independent of category.
  const base = candidates.map(candidate => {
    const outfitItems = resolveOutfitItems(candidate.slots, itemsById);
    const subScores = scoring.computeSubScores(
      outfitItems, candidate.slots, user,
      { occasion: context.occasion, weather: context.weather },
      context.insights,
      {
        collaborativeSignal: context.cfData?.signal ?? null,
        negativeSignals:     context.negativeSignals || {},
        kathmanduContext:    { festivals: context.festivals, season: context.season },
      }
    );
    return { candidate, outfitItems, subScores };
  });

  // 2. One batched ML acceptance-probability call for the entire session.
  const occKey       = (context.occasion || 'daily').toLowerCase().trim().replace(/[\s-]/g, '_');
  const occasionMeta = rules.OCCASION_META[occKey] || { formality: 1 };
  const weatherTier  = rules.getWeatherTier(context.weather?.temp).name;

  const featureBatch = base.map(b => ({
    ...b.subScores,
    occasionFormality: occasionMeta.formality,
    weatherTier,
    isWardrobeOnly: !!context.wardrobeOnly,
  }));

  let mlResult = { available: false, predictions: [] };
  try {
    mlResult = await mlBridge.predictAcceptance(featureBatch);
  } catch {
    // Never let an ML failure block ranking — stays "unavailable".
  }

  base.forEach((b, i) => {
    b.mlAcceptanceProbability = (mlResult.available && mlResult.predictions[i])
      ? mlResult.predictions[i].acceptanceProbability
      : null;
  });

  // 3. Category-weighted ranking of the same pool, once per category.
  const rankedPerCategory = {};
  categories.forEach(catMeta => {
    rankedPerCategory[catMeta.key] = base
      .map(b => {
        const { confidence, breakdown } = scoring.finalizeScore(b.subScores, catMeta.key, b.mlAcceptanceProbability);
        return {
          candidate: b.candidate,
          outfitItems: b.outfitItems,
          subScores: b.subScores,
          mlAcceptanceProbability: b.mlAcceptanceProbability,
          confidence,
          breakdown,
        };
      })
      .sort((a, c) => c.confidence - a.confidence);
  });

  return rankedPerCategory;
};
