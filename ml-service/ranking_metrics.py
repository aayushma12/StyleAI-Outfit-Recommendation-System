# -*- coding: utf-8 -*-
"""
ranking_metrics.py — Ranking-quality evaluation for the acceptance model.

The classification metrics in acceptance_trainer.py (accuracy/precision/
recall/F1/ROC-AUC) treat each candidate outfit as an independent binary
prediction. But the deployed system is fundamentally a RANKING problem —
per session, several candidates are scored and the top ones are shown in
order. This module adds the metrics that actually measure ranking quality:
NDCG (is the best-ranked item genuinely the one the user liked most?),
diversity (are a session's candidates meaningfully different from each
other?), and personalization (do different users get different top picks
for the same occasion, or does everyone see the same "best" outfit?).

KNOWN LIMITATION: diversity/personalization rely on each candidate's real
wardrobe item IDs. Persona-based synthetic sessions (seedPersonaSyntheticBehavior.js)
never reference real WardrobeItem documents — their outfit slots are all
`item: null` — so those two metrics are only meaningful on REAL user
sessions, which are currently few. NDCG only needs status/rating (present on
both), so it's reported separately for real vs. synthetic data.
"""
import math

# status -> relevance, matching Recommendation.rankedRecommendationSchema's
# status enum exactly (worn/saved/liked = accepted variants, weighted by how
# strong a signal they are; disliked/skipped = explicitly rejected).
RELEVANCE_MAP = {"worn": 3, "liked": 2, "saved": 2, "disliked": 0, "skipped": 0}


def ndcg_at_k(relevances: list, predicted_scores: list, k: int = 5) -> float:
    """
    relevances: true relevance per item (same order as predicted_scores).
    predicted_scores: model's predicted acceptance probability per item —
    used only to determine ranking order, not as the relevance itself.
    """
    if not relevances or not predicted_scores or len(relevances) != len(predicted_scores):
        return 0.0
    ranked = [rel for _, rel in sorted(zip(predicted_scores, relevances), key=lambda x: -x[0])][:k]
    dcg = sum((2 ** rel - 1) / math.log2(i + 2) for i, rel in enumerate(ranked))
    ideal = sorted(relevances, reverse=True)[:k]
    idcg = sum((2 ** rel - 1) / math.log2(i + 2) for i, rel in enumerate(ideal))
    return dcg / idcg if idcg > 0 else 0.0


def jaccard(ids_a: set, ids_b: set) -> float:
    """Ported from backend/services/diversityEngine.js's jaccard() exactly,
    so the two numbers are directly comparable if ever cross-checked."""
    if not ids_a and not ids_b:
        return 0.0
    inter = len(ids_a & ids_b)
    union = len(ids_a | ids_b)
    return inter / union if union else 0.0


def _item_ids(outfit: dict) -> set:
    ids = set()
    for slot in (outfit or {}).values():
        item = slot.get("item") if isinstance(slot, dict) else None
        if item:
            ids.add(str(item))
    return ids


def _build_feature_row(rec: dict, context: dict, trainer_mod) -> dict:
    """Reconstructs the same feature vector load_training_data builds per
    row, for a single (not-yet-labeled-for-training) recommendation, so the
    deployed model can be asked to re-score it for NDCG ranking purposes."""
    scores = rec.get("scores") or {}
    row = {}
    for stored_key, feature_key in trainer_mod.STORED_SCORE_TO_FEATURE.items():
        row[feature_key] = (scores.get(stored_key, 70) or 70) / 100.0
    occasion = (context.get("occasion") or "daily").lower()
    row["occasionFormality"] = trainer_mod.OCCASION_FORMALITY.get(occasion, 1)
    row["isWardrobeOnly"] = int(bool(context.get("wardrobeOnly")))
    row["weatherTier"] = trainer_mod.weather_tier_from_temp((context.get("weather") or {}).get("temp"))
    return row


def _ndcg_for_sessions(sessions: list, ml_engine_mod, trainer_mod, k: int = 5) -> dict:
    ndcg_scores = []
    for sess in sessions:
        recs = [r for r in (sess.get("recommendations") or []) if r.get("status") in RELEVANCE_MAP]
        if len(recs) < 2:
            continue
        relevances = [RELEVANCE_MAP[r["status"]] for r in recs]
        feature_rows = [_build_feature_row(r, sess.get("context") or {}, trainer_mod) for r in recs]
        predictions = ml_engine_mod.get_acceptance_predictions(feature_rows)
        if predictions is None:
            # Model unavailable — fall back to the recommendation's own stored
            # confidence as the ranking signal rather than skipping entirely.
            predicted_scores = [r.get("confidence", 50) for r in recs]
        else:
            predicted_scores = [p["acceptanceProbability"] for p in predictions]
        ndcg_scores.append(ndcg_at_k(relevances, predicted_scores, k=min(k, len(relevances))))

    if not ndcg_scores:
        return {"mean": None, "n": 0}
    return {"mean": round(sum(ndcg_scores) / len(ndcg_scores), 4), "n": len(ndcg_scores)}


def _diversity_for_sessions(sessions: list) -> dict:
    diversity_scores = []
    for sess in sessions:
        recs = sess.get("recommendations") or []
        if len(recs) < 2:
            continue
        id_sets = [_item_ids(r.get("outfit")) for r in recs]
        pair_scores = []
        for i in range(len(id_sets)):
            for j in range(i + 1, len(id_sets)):
                pair_scores.append(1 - jaccard(id_sets[i], id_sets[j]))
        if pair_scores:
            diversity_scores.append(sum(pair_scores) / len(pair_scores))

    if not diversity_scores:
        return {"mean": None, "n": 0}
    return {"mean": round(sum(diversity_scores) / len(diversity_scores), 4), "n": len(diversity_scores)}


def _personalization_for_sessions(sessions: list) -> dict:
    """Groups sessions by occasion; within each occasion bucket with >= 2
    distinct users, measures how different each user's top-ranked pick is
    from every other user's — low score means everyone gets the same "best"
    outfit for that occasion (bad personalization), high score means genuine
    per-user variation."""
    by_occasion = {}
    for sess in sessions:
        recs = sorted((sess.get("recommendations") or []), key=lambda r: r.get("rank", 999))
        if not recs:
            continue
        top_ids = _item_ids(recs[0].get("outfit"))
        occasion = (sess.get("context") or {}).get("occasion", "unknown")
        user_id = str(sess.get("user"))
        by_occasion.setdefault(occasion, {})[user_id] = top_ids

    bucket_scores = []
    for occasion, user_top_ids in by_occasion.items():
        users = list(user_top_ids.keys())
        if len(users) < 2:
            continue
        pair_scores = []
        for i in range(len(users)):
            for j in range(i + 1, len(users)):
                pair_scores.append(1 - jaccard(user_top_ids[users[i]], user_top_ids[users[j]]))
        if pair_scores:
            bucket_scores.append(sum(pair_scores) / len(pair_scores))

    if not bucket_scores:
        return {"mean": None, "n": 0}
    return {"mean": round(sum(bucket_scores) / len(bucket_scores), 4), "n": len(bucket_scores)}


def evaluate_ranking_quality(db, ml_engine_mod=None, trainer_mod=None) -> dict:
    """
    Pulls complete sessions with >= 2 embedded recommendations, splits them
    into real vs. synthetic, and computes NDCG@5 for each pool separately
    (never conflated — mixing them would misrepresent real-user ranking
    quality). Diversity and personalization are computed on REAL sessions
    only, per this module's documented limitation (see file header).
    """
    if ml_engine_mod is None:
        import ml_engine as ml_engine_mod
    if trainer_mod is None:
        import acceptance_trainer as trainer_mod

    cursor = db.recommendations.find(
        {"status": "complete", "$expr": {"$gte": [{"$size": {"$ifNull": ["$recommendations", []]}}, 2]}},
        {"recommendations": 1, "context": 1, "synthetic": 1, "user": 1},
    )
    all_sessions = list(cursor)
    real_sessions = [s for s in all_sessions if not s.get("synthetic")]
    synthetic_sessions = [s for s in all_sessions if s.get("synthetic")]

    return {
        "ndcg_at_5_real":      _ndcg_for_sessions(real_sessions, ml_engine_mod, trainer_mod),
        "ndcg_at_5_synthetic": _ndcg_for_sessions(synthetic_sessions, ml_engine_mod, trainer_mod),
        "diversity":           _diversity_for_sessions(real_sessions),
        "personalization":     _personalization_for_sessions(real_sessions),
        "note": "diversity/personalization use real wardrobe item IDs and are only meaningful on real user sessions; synthetic sessions don't reference real items.",
    }
