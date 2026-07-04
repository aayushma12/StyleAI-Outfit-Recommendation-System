'use strict';

// ── Diversity selection ──────────────────────────────────────────────────────
// Deterministically guarantees the 5 (or 3, for wizard) selected outfits are
// genuinely distinct from each other AND from what was recently recommended —
// replacing the old "trust the LLM to vary itself" prompt instruction with an
// actual code guarantee. On top of that, selection among near-tied top
// candidates is weighted-random (see weightedRandomPick) rather than always
// picking the single highest scorer — otherwise, with an unchanging wardrobe
// and context, the same "best" outfit would win literally every single call.

const scoring = require('./scoringService');

const WITHIN_SESSION_OVERLAP_THRESHOLD = 0.6;
const TOP_N_CANDIDATES_CONSIDERED      = 15;
const HISTORY_OVERLAP_PENALTY_WEIGHT   = 0.25;
const RERANK_OVERLAP_PENALTY_WEIGHT    = 0.35;
const NEAR_TIE_TOLERANCE               = 5; // confidence points
const NEAR_TIE_POOL_MAX                = 5;

/**
 * Score-weighted random pick restricted to a near-tie band around the top
 * scorer, so relevance is never sacrificed for variety: a candidate outside
 * the tolerance band is structurally excluded from the draw. With a single
 * (or no) near-tied competitor this collapses to the deterministic top pick.
 * `rng` is injectable (`() => number in [0,1)`) so tests can fix it while
 * production always uses genuine `Math.random`.
 */
function weightedRandomPick(pool, rng) {
  if (!pool.length) return null;
  const top = pool[0].adjConfidence;
  const nearTied = pool
    .filter(p => top - p.adjConfidence <= NEAR_TIE_TOLERANCE)
    .slice(0, NEAR_TIE_POOL_MAX);

  if (nearTied.length <= 1) return pool[0];

  const totalWeight = nearTied.reduce((sum, p) => sum + Math.max(0.01, p.adjConfidence), 0);
  let roll = rng() * totalWeight;
  for (const p of nearTied) {
    roll -= Math.max(0.01, p.adjConfidence);
    if (roll <= 0) return p;
  }
  return nearTied[nearTied.length - 1];
}

function jaccard(idsA, idsB) {
  const setA = new Set(idsA), setB = new Set(idsB);
  if (setA.size === 0 && setB.size === 0) return 0;
  let inter = 0;
  for (const id of setA) if (setB.has(id)) inter++;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : inter / union;
}

function overlapWithHistory(sourceItemIds, recentlyRecommendedItemIds) {
  if (!recentlyRecommendedItemIds || recentlyRecommendedItemIds.size === 0 || sourceItemIds.length === 0) return 0;
  let hits = 0;
  for (const id of sourceItemIds) if (recentlyRecommendedItemIds.has(id)) hits++;
  return hits / sourceItemIds.length;
}

/**
 * @param {object} rankedPerCategory - output of rankingService.rankForCategories
 * @param {Array}  categories        - scoring.RECOMMENDATION_CATEGORIES or WIZARD_CATEGORIES
 * @param {object} context           - needs context.recentlyRecommendedItemIds (a Set)
 * @returns {Array<{catMeta, scored}>}
 */
exports.selectDiverse = function selectDiverse(rankedPerCategory, categories, context = {}) {
  const recentlyRecommendedItemIds = context.recentlyRecommendedItemIds;
  const rng = context.rng || Math.random;
  const selected = [];
  const selectedItemSets = [];

  categories.forEach((catMeta, idx) => {
    let pool = rankedPerCategory[catMeta.key] || [];
    if (!pool.length) return;

    // A "wardrobe" category (e.g. wardrobe_champion) must be 100% owned items —
    // filter to fully-owned candidates when any exist, rather than trusting an
    // LLM instruction to not invent items.
    if (/wardrobe/i.test(catMeta.key)) {
      const strict = pool.filter(p => (p.candidate.needsSuggestion || []).length === 0);
      if (strict.length) pool = strict;
    }

    // Cross-session freshness: prefer candidates that don't exactly match an
    // outfit already served in the last few days — fall back to the full pool
    // if literally everything has been shown recently (small wardrobe), so a
    // category is never dropped just because nothing is "fresh".
    if (context.recentlyServedFingerprints?.size) {
      const fresh = pool.filter(p => !context.recentlyServedFingerprints.has(scoring.fingerprintOutfit(p.candidate.slots)));
      if (fresh.length) pool = fresh;
    }

    // Cross-session penalty: candidates leaning heavily on recently-recommended
    // items get soft-demoted, so neglected wardrobe pieces surface over time.
    const withHistoryPenalty = pool.map(p => {
      const overlap = overlapWithHistory(p.candidate.sourceItemIds, recentlyRecommendedItemIds);
      const adjConfidence = p.confidence * (1 - HISTORY_OVERLAP_PENALTY_WEIGHT * overlap);
      return { ...p, adjConfidence };
    }).sort((a, b) => b.adjConfidence - a.adjConfidence);

    let chosen = null;

    if (selectedItemSets.length === 0) {
      chosen = weightedRandomPick(withHistoryPenalty, rng);
    } else {
      const topN = withHistoryPenalty.slice(0, TOP_N_CANDIDATES_CONSIDERED);
      const distinct = topN.filter(p =>
        selectedItemSets.every(prevIds => jaccard(p.candidate.sourceItemIds, prevIds) < WITHIN_SESSION_OVERLAP_THRESHOLD)
      );
      chosen = distinct.length ? weightedRandomPick(distinct, rng) : null;

      if (!chosen && topN.length) {
        // Soft re-rank fallback: no candidate clears the distinctness bar —
        // penalize by max overlap with anything already picked and take the best.
        // Deterministic on purpose: this only fires when there genuinely isn't
        // enough wardrobe variety to pick from, so there's no distinctness
        // upside to justify randomizing among worse options.
        chosen = [...topN].sort((a, b) => {
          const maxOverlapA = Math.max(0, ...selectedItemSets.map(prevIds => jaccard(a.candidate.sourceItemIds, prevIds)));
          const maxOverlapB = Math.max(0, ...selectedItemSets.map(prevIds => jaccard(b.candidate.sourceItemIds, prevIds)));
          return (b.adjConfidence * (1 - RERANK_OVERLAP_PENALTY_WEIGHT * maxOverlapB))
               - (a.adjConfidence * (1 - RERANK_OVERLAP_PENALTY_WEIGHT * maxOverlapA));
        })[0];
      }
      if (!chosen) chosen = withHistoryPenalty[0];
    }

    if (chosen) {
      selected.push({ catMeta, scored: chosen, rank: idx + 1 });
      selectedItemSets.push(chosen.candidate.sourceItemIds);
    }
  });

  return selected;
};
