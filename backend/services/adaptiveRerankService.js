'use strict';

// ── Session-level adaptive re-ranking ───────────────────────────────────────
// When a user dislikes a recommendation with a specific reason, immediately
// re-score the OTHER still-pending recommendations in the same session using
// their already-persisted per-dimension data — no regeneration, no extra ML/
// candidate-generation call. Bounded scope, by design: the full original
// candidate pool is discarded after generation (see recommendationEngine.js's
// runPipeline — only candidatePoolSize, a count, survives), so this operates
// on (a) the session's own shown-but-pending recommendations, and (b) each
// category's small stored `alternates` pool (top 2 runner-ups captured once
// at generation time, see recommendationEngine.buildAlternates). A documented
// tradeoff, not an oversight — see the plan/README for the full reasoning.

const WardrobeItem = require('../models/WardrobeItem');
const scoring = require('./scoringService');

// Reason -> adjustment strategy. Reasons with a clean structural signal get a
// targeted adjustment; reasons without one (no verified per-item field to
// hang a heuristic on) fall back to a gentler generic "distinctness boost"
// rather than inventing an unverified attribute match.
const REASON_ADJUSTMENTS = {
  wrong_color:   { type: 'color_overlap_penalty' },
  too_formal:    { type: 'formality_shift', direction: -1 }, // reward LESS formal alternatives
  too_casual:    { type: 'formality_shift', direction:  1 }, // reward MORE formal alternatives
  too_expensive: { type: 'owned_ratio_boost' },
  wrong_style:   { type: 'style_overlap_penalty' },
  wrong_fabric:   { type: 'distinctness_boost' },
  wrong_occasion: { type: 'distinctness_boost' },
  wrong_season:   { type: 'distinctness_boost' },
  already_own:    { type: 'distinctness_boost' },
  poor_fit:       { type: 'distinctness_boost' },
};

const ADJUSTMENT_MAGNITUDE = 0.08; // max confidence-fraction nudge per matching reason — small and additive

function colorsOf(item) {
  if (!item) return [];
  if (Array.isArray(item.colorHex) && item.colorHex.length) return item.colorHex.map(c => c.toLowerCase());
  if (!item.color) return [];
  return item.color.split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
}

function itemIdsOf(outfitSlots) {
  return Object.values(outfitSlots || {}).map(s => s?.item).filter(Boolean).map(String);
}

function ownedRatio(outfitSlots) {
  const slots = Object.values(outfitSlots || {}).filter(s => s?.name || s?.suggestion);
  if (!slots.length) return 0.5;
  return slots.filter(s => s?.item).length / slots.length;
}

function jaccard(idsA, idsB) {
  const setA = new Set(idsA), setB = new Set(idsB);
  if (!setA.size && !setB.size) return 0;
  let inter = 0;
  for (const id of setA) if (setB.has(id)) inter++;
  return inter / new Set([...setA, ...setB]).size;
}

/**
 * @param {object} session     - the Mongoose Recommendation document (already loaded, not yet saved)
 * @param {object} dislikedRec - the sub-doc just marked disliked/skipped (already mutated by the caller)
 * @param {Array}  reasons     - the feedback reason strings sent with this action
 * @returns {Promise<boolean>} whether anything in the session actually changed
 */
exports.reRankOnDislike = async function reRankOnDislike(session, dislikedRec, reasons = []) {
  const pendingRecs = session.recommendations.filter(r => r.status === 'pending' && r.category !== dislikedRec.category);
  if (!pendingRecs.length || !reasons.length) return false;

  const allItemIds = [...new Set([
    ...itemIdsOf(dislikedRec.outfit),
    ...pendingRecs.flatMap(r => itemIdsOf(r.outfit)),
  ])];
  if (!allItemIds.length) return false;

  const items = await WardrobeItem.find({ _id: { $in: allItemIds } }).lean();
  const itemsById = new Map(items.map(it => [String(it._id), it]));
  const resolveItems = outfitSlots => itemIdsOf(outfitSlots).map(id => itemsById.get(id)).filter(Boolean);

  const dislikedItems      = resolveItems(dislikedRec.outfit);
  const dislikedColors     = new Set(dislikedItems.flatMap(colorsOf));
  const dislikedStyles     = new Set(dislikedItems.flatMap(scoring.inferItemStyles));
  const dislikedFormality  = scoring.avgFormality(dislikedItems);
  const dislikedItemIds    = itemIdsOf(dislikedRec.outfit);
  const dislikedOwnedRatio = ownedRatio(dislikedRec.outfit);

  let anyAdjusted = false;

  for (const rec of pendingRecs) {
    const recItems = resolveItems(rec.outfit);
    let nudge = 0;

    for (const reason of reasons) {
      const adj = REASON_ADJUSTMENTS[reason];
      if (!adj) continue;

      if (adj.type === 'color_overlap_penalty') {
        const recColors = recItems.flatMap(colorsOf);
        if (recColors.length) {
          const overlap = recColors.filter(c => dislikedColors.has(c)).length / recColors.length;
          nudge -= overlap * ADJUSTMENT_MAGNITUDE;
        }
      } else if (adj.type === 'formality_shift') {
        const recFormality = scoring.avgFormality(recItems);
        if (recFormality !== null && dislikedFormality !== null && recFormality !== dislikedFormality) {
          if (Math.sign(recFormality - dislikedFormality) === adj.direction) nudge += ADJUSTMENT_MAGNITUDE;
        }
      } else if (adj.type === 'owned_ratio_boost') {
        if (ownedRatio(rec.outfit) > dislikedOwnedRatio) nudge += ADJUSTMENT_MAGNITUDE;
      } else if (adj.type === 'style_overlap_penalty') {
        const recStyles = recItems.flatMap(scoring.inferItemStyles);
        if (recStyles.length) {
          const overlap = recStyles.filter(s => dislikedStyles.has(s)).length / recStyles.length;
          nudge -= overlap * ADJUSTMENT_MAGNITUDE;
        }
      } else if (adj.type === 'distinctness_boost') {
        const similarity = jaccard(itemIdsOf(rec.outfit), dislikedItemIds);
        nudge += (1 - similarity) * ADJUSTMENT_MAGNITUDE * 0.5; // gentler — no clean structural signal to lean on
      }
    }

    if (nudge !== 0) {
      const newConfidence = Math.max(10, Math.min(99, Math.round(rec.confidence + nudge * 100)));
      if (newConfidence !== rec.confidence) {
        rec.confidence = newConfidence;
        anyAdjusted = true;
      }
    }
  }

  // Re-rank all still-pending recs by their (possibly just-adjusted) confidence.
  const allPending = session.recommendations.filter(r => r.status === 'pending');
  allPending.sort((a, b) => b.confidence - a.confidence).forEach((r, i) => { r.rank = i + 1; });

  // If the disliked category has a stored alternate that now outscores the
  // lowest-ranked pending rec, promote it into the disliked rec's slot —
  // real, already-scored wardrobe content, not a regenerated guess.
  if (dislikedRec.alternates?.length) {
    const best = [...dislikedRec.alternates].sort((a, b) => b.confidence - a.confidence)[0];
    const lowestPending = allPending[allPending.length - 1];
    if (best && (!lowestPending || best.confidence > lowestPending.confidence)) {
      dislikedRec.confidence  = best.confidence;
      dislikedRec.scores      = best.scores;
      dislikedRec.outfitName  = best.outfitName;
      dislikedRec.outfit      = best.outfit;
      dislikedRec.explanation = best.explanation;
      dislikedRec.status      = 'pending'; // the swapped-in alternate starts fresh
      dislikedRec.userFeedback = '';
      dislikedRec.feedbackReasons = [];
      dislikedRec.alternates  = dislikedRec.alternates.filter(a => a !== best);
      anyAdjusted = true;
    }
  }

  return anyAdjusted;
};
