# -*- coding: utf-8 -*-
"""Unit tests for ranking_metrics.py's pure functions (ndcg_at_k, jaccard)."""
import sys
import os
import math

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import ranking_metrics as rm


def test_ndcg_perfect_ranking_scores_1():
    # Predicted scores already in descending relevance order.
    assert rm.ndcg_at_k([3, 2, 0], [0.9, 0.6, 0.1], k=3) == 1.0


def test_ndcg_inverted_ranking_scores_below_1_and_matches_hand_computation():
    relevances = [3, 2, 0]
    predicted = [0.1, 0.6, 0.9]  # ranks them [0, 2, 3] i.e. reversed
    result = rm.ndcg_at_k(relevances, predicted, k=3)
    ranked = [0, 2, 3]  # relevance in the order the (wrong) predicted scores would rank them
    dcg = sum((2 ** rel - 1) / math.log2(i + 2) for i, rel in enumerate(ranked))
    ideal = sorted(relevances, reverse=True)
    idcg = sum((2 ** rel - 1) / math.log2(i + 2) for i, rel in enumerate(ideal))
    expected = dcg / idcg
    assert result < 1.0
    assert abs(result - expected) < 1e-9


def test_ndcg_all_zero_relevance_returns_zero_not_a_crash():
    assert rm.ndcg_at_k([0, 0, 0], [0.9, 0.5, 0.1], k=3) == 0.0


def test_ndcg_empty_input_returns_zero():
    assert rm.ndcg_at_k([], [], k=5) == 0.0


def test_ndcg_mismatched_lengths_returns_zero_rather_than_raising():
    assert rm.ndcg_at_k([1, 2], [0.5], k=5) == 0.0


# ── jaccard (ported from diversityEngine.js) ────────────────────────────────

def test_jaccard_identical_sets_is_1():
    assert rm.jaccard({'a', 'b'}, {'a', 'b'}) == 1.0


def test_jaccard_disjoint_sets_is_0():
    assert rm.jaccard({'a'}, {'b'}) == 0.0


def test_jaccard_both_empty_is_0_matching_js_semantics():
    # Mirrors diversityEngine.js's jaccard(): "if both empty, return 0" —
    # not 1, even though set-theoretically an empty/empty comparison is
    # sometimes defined as identical.
    assert rm.jaccard(set(), set()) == 0.0


def test_jaccard_partial_overlap():
    assert rm.jaccard({'a', 'b', 'c'}, {'b', 'c', 'd'}) == 0.5  # intersection=2, union=4


# ── evaluate_ranking_quality — degradation behavior with fake DB/ml_engine ──

class FakeCursorDB:
    def __init__(self, docs):
        self._docs = docs
        self.recommendations = self

    def find(self, query, projection):
        return iter(self._docs)


class FakeMlEngine:
    @staticmethod
    def get_acceptance_predictions(rows):
        # Neutral 0.5 for every row — deterministic and sufficient to prove
        # the pipeline runs end-to-end without needing a real trained model.
        return [{'acceptanceProbability': 0.5} for _ in rows]


def test_evaluate_ranking_quality_handles_no_qualifying_sessions_gracefully():
    import acceptance_trainer as trainer_mod
    result = rm.evaluate_ranking_quality(FakeCursorDB([]), ml_engine_mod=FakeMlEngine(), trainer_mod=trainer_mod)
    assert result['ndcg_at_5_real']['n'] == 0
    assert result['ndcg_at_5_real']['mean'] is None
    assert result['diversity']['n'] == 0
    assert result['personalization']['n'] == 0


def test_evaluate_ranking_quality_separates_real_and_synthetic_ndcg():
    import acceptance_trainer as trainer_mod

    def mk_session(synthetic, user):
        return {
            'synthetic': synthetic,
            'user': user,
            'context': {'occasion': 'daily', 'wardrobeOnly': False, 'weather': {'temp': 20}},
            'recommendations': [
                {'status': 'worn', 'confidence': 90, 'scores': {}, 'outfit': {}},
                {'status': 'disliked', 'confidence': 40, 'scores': {}, 'outfit': {}},
            ],
        }

    docs = [mk_session(False, 'u1'), mk_session(True, 'u2')]
    result = rm.evaluate_ranking_quality(FakeCursorDB(docs), ml_engine_mod=FakeMlEngine(), trainer_mod=trainer_mod)
    assert result['ndcg_at_5_real']['n'] == 1
    assert result['ndcg_at_5_synthetic']['n'] == 1
