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

// ── Polyvore compat-model feature extraction ────────────────────────────────
// Mirrors ml-service/polyvore_compat_trainer.py's build_outfit_features()
// exactly (same field names/order) — see that file's ALL_FEATURES. Bucket
// names match WardrobeItem.js's `category` enum directly (no subgroup
// translation needed on this side, unlike the Polyvore-category mapping the
// Python trainer needs).
const COMPAT_BUCKETS = ['tops', 'bottoms', 'dresses', 'footwear', 'accessories'];

function circularHueDistance(a, b) {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

function buildCompatFeatures(outfitItems) {
  const bucketCounts = { tops: 0, bottoms: 0, dresses: 0, footwear: 0, accessories: 0 };
  outfitItems.forEach(it => {
    if (bucketCounts[it.category] !== undefined) bucketCounts[it.category]++;
  });
  const bucketsPresent = COMPAT_BUCKETS.filter(b => bucketCounts[b] > 0);

  const allColors        = outfitItems.flatMap(it => scoring.extractColors(it).map(c => c.toLowerCase()));
  const neutralColors     = allColors.filter(c => rules.NEUTRAL_COLORS.has(c));
  const nonNeutralColors  = allColors.filter(c => rules.COLOR_HUE[c] !== undefined);
  const hues              = nonNeutralColors.map(c => rules.COLOR_HUE[c]);

  let avgHueDist = 0, minHueDist = 0, hasMultipleHues = 0;
  if (hues.length >= 2) {
    const pairDists = [];
    for (let i = 0; i < hues.length; i++) {
      for (let j = i + 1; j < hues.length; j++) pairDists.push(circularHueDistance(hues[i], hues[j]));
    }
    avgHueDist = pairDists.reduce((a, b) => a + b, 0) / pairDists.length;
    minHueDist = Math.min(...pairDists);
    hasMultipleHues = 1;
  }

  return {
    numItems:              outfitItems.length,
    numTops:                bucketCounts.tops,
    numBottoms:              bucketCounts.bottoms,
    numDresses:              bucketCounts.dresses,
    numFootwear:             bucketCounts.footwear,
    numAccessories:          bucketCounts.accessories,
    categoryDiversity:       bucketsPresent.length,
    hasDressAndBottom:       (bucketCounts.dresses > 0 && bucketCounts.bottoms > 0) ? 1 : 0,
    numColorsDetected:       neutralColors.length + nonNeutralColors.length,
    numNeutralColors:        neutralColors.length,
    numNonNeutralColors:     nonNeutralColors.length,
    hasMultipleHues,
    avgPairwiseHueDistance:  avgHueDist,
    minPairwiseHueDistance:  minHueDist,
  };
}

/**
 * @param {Array}  candidates - output of candidateGenerationService.generateCandidates
 * @param {object} user
 * @param {object} context    - output of contextEngine.buildContext
 * @param {Array}  categories - scoring.RECOMMENDATION_CATEGORIES or WIZARD_CATEGORIES
 * @param {object} wizardParams - optional { dresscode, budget, indoorOutdoor, dayNight, vibe }
 *   from the recommendation wizard — only ever passed by generateWizardSession.
 *   Absent (default {}) for every standard dashboard session, so the 5 new
 *   scoring dimensions are simply never computed there — zero behavior change
 *   to the existing 5 non-wizard categories.
 * @returns {Promise<object>} - { [categoryKey]: [{candidate, outfitItems, subScores, mlAcceptanceProbability, datasetCompatProbability, confidence, breakdown}, ...] } sorted descending by confidence
 */
exports.rankForCategories = async function rankForCategories(candidates, user, context, categories, wizardParams = {}) {
  const itemsById = new Map((context.wardrobeItems || []).map(it => [String(it._id), it]));

  // 1. Sub-scores — computed once per candidate, independent of category.
  const base = candidates.map(candidate => {
    const outfitItems = resolveOutfitItems(candidate.slots, itemsById);
    const subScores = scoring.computeSubScores(
      outfitItems, candidate.slots, user,
      {
        occasion: context.occasion, weather: context.weather,
        dresscode: wizardParams.dresscode, budget: wizardParams.budget,
        indoorOutdoor: wizardParams.indoorOutdoor, dayNight: wizardParams.dayNight,
        vibe: wizardParams.vibe,
      },
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

  // 2b. One batched call to the independent Polyvore-trained compat model —
  // separate circuit breaker/endpoint, so an outage here never affects the
  // acceptance-model call above. See scoringService.finalizeScore for why
  // this is attached to the breakdown but NOT blended into `confidence` yet.
  const compatFeatureBatch = base.map(b => buildCompatFeatures(b.outfitItems));
  let compatResult = { available: false, predictions: [] };
  try {
    compatResult = await mlBridge.predictCompat(compatFeatureBatch);
  } catch {
    // Same never-block-ranking discipline as the acceptance-model call.
  }

  base.forEach((b, i) => {
    b.mlAcceptanceProbability = (mlResult.available && mlResult.predictions[i])
      ? mlResult.predictions[i].acceptanceProbability
      : null;
    b.datasetCompatProbability = (compatResult.available && compatResult.predictions[i])
      ? compatResult.predictions[i].datasetCompatProbability
      : null;
  });

  // 3. Category-weighted ranking of the same pool, once per category.
  const rankedPerCategory = {};
  categories.forEach(catMeta => {
    rankedPerCategory[catMeta.key] = base
      .map(b => {
        const { confidence, breakdown, ruleScore } = scoring.finalizeScore(b.subScores, catMeta.key, b.mlAcceptanceProbability);
        return {
          candidate: b.candidate,
          outfitItems: b.outfitItems,
          subScores: b.subScores,
          mlAcceptanceProbability: b.mlAcceptanceProbability,
          datasetCompatProbability: b.datasetCompatProbability,
          confidence,
          breakdown,
          ruleScore,
        };
      })
      .sort((a, c) => c.confidence - a.confidence);
  });

  return rankedPerCategory;
};
