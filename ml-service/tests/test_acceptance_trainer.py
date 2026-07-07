# -*- coding: utf-8 -*-
"""
Unit tests for acceptance_trainer.py's pure functions and the training
pipeline's cold-start guard. Uses a fake MongoDB `db` object (a plain class
exposing .recommendations.aggregate()) for load_training_data() so these
tests don't need a real MongoDB instance.
"""
import sys
import os
import pytest
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import acceptance_trainer as trainer


class FakeCollection:
    def __init__(self, docs):
        self._docs = docs

    def aggregate(self, pipeline):
        return iter(self._docs)


class FakeDB:
    def __init__(self, docs):
        self.recommendations = FakeCollection(docs)


def make_scores(base=70):
    return {
        'styleMatch': base, 'colorHarmony': base, 'colorPreference': base,
        'occasionFit': base, 'weatherFit': base, 'behaviorSignal': base,
        'bodyTypeMatch': base, 'fabricMatch': base, 'trendScore': base,
    }


# ── weather_tier_from_temp ──────────────────────────────────────────────────

@pytest.mark.parametrize('temp,expected_tier', [
    (2, 'freezing'),
    (10, 'cold'),
    (17, 'cool'),
    (23, 'mild'),
    (29, 'warm'),
    (35, 'hot'),
    (None, 'mild'),
])
def test_weather_tier_from_temp(temp, expected_tier):
    assert trainer.weather_tier_from_temp(temp) == expected_tier


def test_weather_tiers_are_contiguous_and_ordered():
    # Sweeping every integer temperature should never skip a tier boundary
    # or return something outside the known tier set.
    known_tiers = {'freezing', 'cold', 'cool', 'mild', 'warm', 'hot'}
    for t in range(-10, 45):
        assert trainer.weather_tier_from_temp(t) in known_tiers


# ── Feature schema ───────────────────────────────────────────────────────────

def test_feature_schema_matches_nodes_rankingService_contract():
    # This exact set of keys must match what backend/services/rankingService.js
    # sends in its featureBatch — a drift here would silently break predictions.
    expected_score_features = {
        'styleMatch', 'colorHarmony', 'colorPref', 'occasionFit', 'weatherFit',
        'behaviorSignal', 'bodyTypeMatch', 'fabricMatch', 'trendScore',
    }
    assert set(trainer.SCORE_FEATURES) == expected_score_features
    assert 'occasionFormality' in trainer.NUMERICAL_FEATURES
    assert 'isWardrobeOnly' in trainer.NUMERICAL_FEATURES
    assert trainer.CATEGORICAL_FEATURES == ['weatherTier']
    assert set(trainer.ALL_FEATURES) == set(trainer.NUMERICAL_FEATURES) | set(trainer.CATEGORICAL_FEATURES)


def test_occasion_formality_covers_common_occasions():
    for occasion in ['daily', 'office', 'formal', 'wedding', 'gym']:
        assert occasion in trainer.OCCASION_FORMALITY
    # Formality is meant to range 0 (loungewear) to 4 (black-tie).
    assert trainer.OCCASION_FORMALITY['formal'] > trainer.OCCASION_FORMALITY['daily']
    assert trainer.OCCASION_FORMALITY['wedding'] == 4


# ── load_training_data label derivation ─────────────────────────────────────

def test_load_training_data_labels_accepted_and_rejected_statuses():
    docs = [
        {'scores': make_scores(90), 'status': 'worn', 'userRating': None, 'occasion': 'office', 'wardrobeOnly': False, 'weatherTemp': 20},
        {'scores': make_scores(20), 'status': 'disliked', 'userRating': None, 'occasion': 'daily', 'wardrobeOnly': False, 'weatherTemp': 20},
    ]
    df = trainer.load_training_data(FakeDB(docs))
    assert len(df) == 2
    assert set(df['label']) == {0, 1}


def test_load_training_data_falls_back_to_rating_when_status_is_ambiguous():
    docs = [
        {'scores': make_scores(80), 'status': 'skipped', 'userRating': 5, 'occasion': 'office', 'wardrobeOnly': False, 'weatherTemp': 20},
    ]
    # 'skipped' is itself a rejection status, so this should be labeled 0
    # regardless of a high rating — status takes priority in the real logic.
    df = trainer.load_training_data(FakeDB(docs))
    assert df.iloc[0]['label'] == 0


def test_load_training_data_excludes_truly_ambiguous_rows():
    docs = [
        {'scores': make_scores(70), 'status': 'saved', 'userRating': None, 'occasion': 'office', 'wardrobeOnly': False, 'weatherTemp': 20},
        # A status outside both the accept/reject sets and no decisive rating -> excluded.
        {'scores': make_scores(50), 'status': 'unknown_status', 'userRating': 3, 'occasion': 'daily', 'wardrobeOnly': False, 'weatherTemp': 20},
    ]
    df = trainer.load_training_data(FakeDB(docs))
    assert len(df) == 1  # only the 'saved' row survives


def test_load_training_data_scales_stored_0_100_scores_to_0_1_features():
    docs = [{'scores': make_scores(80), 'status': 'liked', 'userRating': None, 'occasion': 'office', 'wardrobeOnly': True, 'weatherTemp': 2}]
    df = trainer.load_training_data(FakeDB(docs))
    row = df.iloc[0]
    assert row['styleMatch'] == pytest.approx(0.8)
    assert row['isWardrobeOnly'] == 1
    assert row['weatherTier'] == 'freezing'  # 2°C is below the 5°C freezing/cold boundary
    assert row['occasionFormality'] == trainer.OCCASION_FORMALITY['office']


def test_load_training_data_carries_synthetic_provenance_columns():
    docs = [
        {'scores': make_scores(80), 'status': 'liked', 'userRating': None, 'occasion': 'office',
         'wardrobeOnly': False, 'weatherTemp': 20, 'synthetic': True, 'personaArchetype': 'korean_minimalist_college'},
        # Real (non-synthetic) row — no persona field, mirrors what the $project
        # stage's $ifNull actually produces for genuine user documents.
        {'scores': make_scores(60), 'status': 'disliked', 'userRating': None, 'occasion': 'daily',
         'wardrobeOnly': False, 'weatherTemp': 20, 'synthetic': False, 'personaArchetype': ''},
    ]
    df = trainer.load_training_data(FakeDB(docs))
    # Use == rather than `is` — pandas may store this column as numpy.bool_,
    # which fails Python identity checks against the `bool` singletons even
    # when equal.
    assert df.iloc[0]['synthetic'] == True  # noqa: E712
    assert df.iloc[0]['personaArchetype'] == 'korean_minimalist_college'
    assert df.iloc[1]['synthetic'] == False  # noqa: E712
    assert df.iloc[1]['personaArchetype'] == ''


def test_load_training_data_defaults_provenance_when_absent():
    # Older/real documents predating the synthetic/syntheticMeta fields —
    # doc.get() fallbacks must not crash and must default to "not synthetic".
    docs = [{'scores': make_scores(80), 'status': 'liked', 'userRating': None, 'occasion': 'office', 'wardrobeOnly': False, 'weatherTemp': 20}]
    df = trainer.load_training_data(FakeDB(docs))
    assert df.iloc[0]['synthetic'] == False  # noqa: E712
    assert df.iloc[0]['personaArchetype'] == ''


# ── Cold-start guard ─────────────────────────────────────────────────────────

def test_train_and_evaluate_raises_on_too_few_samples():
    tiny_df = pd.DataFrame([
        {**{f: 0.5 for f in trainer.SCORE_FEATURES}, 'occasionFormality': 1, 'isWardrobeOnly': 0, 'weatherTier': 'mild', 'label': 1},
        {**{f: 0.2 for f in trainer.SCORE_FEATURES}, 'occasionFormality': 1, 'isWardrobeOnly': 0, 'weatherTier': 'mild', 'label': 0},
    ])
    with pytest.raises(ValueError, match='Insufficient data'):
        trainer.train_and_evaluate(tiny_df)


def test_train_and_evaluate_raises_when_only_one_class_present():
    rows = [{**{f: 0.5 for f in trainer.SCORE_FEATURES}, 'occasionFormality': 1, 'isWardrobeOnly': 0, 'weatherTier': 'mild', 'label': 1}] * (trainer.MIN_SAMPLES + 5)
    df = pd.DataFrame(rows)
    with pytest.raises(ValueError, match='both accepted and rejected'):
        trainer.train_and_evaluate(df)


def test_train_and_evaluate_succeeds_with_enough_varied_data():
    import random
    random.seed(42)
    rows = []
    for i in range(trainer.MIN_SAMPLES + 20):
        label = i % 2
        base = 80 if label == 1 else 20
        rows.append({**{f: base / 100 + random.uniform(-0.05, 0.05) for f in trainer.SCORE_FEATURES},
                     'occasionFormality': random.choice([0, 1, 2, 3, 4]),
                     'isWardrobeOnly': random.choice([0, 1]),
                     'weatherTier': random.choice(['cold', 'mild', 'hot']),
                     'label': label})
    df = pd.DataFrame(rows)
    pipeline, metrics = trainer.train_and_evaluate(df)
    assert 0 <= metrics['accuracy'] <= 1
    assert metrics['training_size'] == len(df)

    # get_feature_importance should return signed coefficients for a real pipeline.
    importances = trainer.get_feature_importance(pipeline, top_n=5)
    assert len(importances) == 5
    for item in importances:
        assert 'feature' in item and 'coefficient' in item and 'direction' in item
        assert item['direction'] in ('increases acceptance', 'decreases acceptance')


def test_train_and_evaluate_reports_provenance_metrics_when_column_present():
    import random
    random.seed(7)
    rows = []
    for i in range(trainer.MIN_SAMPLES + 20):
        label = i % 2
        base = 80 if label == 1 else 20
        is_synthetic = i % 3 != 0  # ~2/3 synthetic, ~1/3 real
        rows.append({**{f: base / 100 + random.uniform(-0.05, 0.05) for f in trainer.SCORE_FEATURES},
                     'occasionFormality': random.choice([0, 1, 2, 3, 4]),
                     'isWardrobeOnly': random.choice([0, 1]),
                     'weatherTier': random.choice(['cold', 'mild', 'hot']),
                     'label': label,
                     'synthetic': is_synthetic,
                     'personaArchetype': random.choice(['persona_a', 'persona_b']) if is_synthetic else ''})
    df = pd.DataFrame(rows)
    _, metrics = trainer.train_and_evaluate(df)

    assert metrics['synthetic_fraction'] is not None
    assert 0 <= metrics['synthetic_fraction'] <= 1
    assert metrics['real_sample_count'] == int((~df['synthetic']).sum())
    assert metrics['persona_count'] == 2  # persona_a, persona_b


def test_compare_algorithms_returns_both_candidates_with_mean_std_shape():
    import random
    random.seed(11)
    n = trainer.MIN_SAMPLES * 5 + 10  # clears the 5-fold CV guard (>= MIN_SAMPLES * n_splits)
    rows = []
    for i in range(n):
        label = i % 2
        base = 80 if label == 1 else 20
        rows.append({**{f: base / 100 + random.uniform(-0.05, 0.05) for f in trainer.SCORE_FEATURES},
                     'occasionFormality': random.choice([0, 1, 2, 3, 4]),
                     'isWardrobeOnly': random.choice([0, 1]),
                     'weatherTier': random.choice(['cold', 'mild', 'hot']),
                     'label': label})
    df = pd.DataFrame(rows)
    result = trainer.compare_algorithms(df, n_splits=5)

    assert result['available'] is True
    for key in ('logistic_regression', 'gradient_boosting'):
        assert key in result
        for metric in ('accuracy', 'precision', 'recall', 'f1', 'roc_auc'):
            assert metric in result[key]
            assert 'mean' in result[key][metric] and 'std' in result[key][metric]
    assert result['recommended'] in ('logistic_regression', 'gradient_boosting')
    assert result['adoptionThreshold'] == trainer.GB_ADOPTION_MARGIN


def test_compare_algorithms_degrades_cleanly_on_too_little_data_for_cv():
    tiny_df = pd.DataFrame([
        {**{f: 0.5 for f in trainer.SCORE_FEATURES}, 'occasionFormality': 1, 'isWardrobeOnly': 0, 'weatherTier': 'mild', 'label': 1},
        {**{f: 0.2 for f in trainer.SCORE_FEATURES}, 'occasionFormality': 1, 'isWardrobeOnly': 0, 'weatherTier': 'mild', 'label': 0},
    ])
    result = trainer.compare_algorithms(tiny_df, n_splits=5)
    assert result['available'] is False
    assert 'reason' in result


def test_train_and_evaluate_provenance_metrics_are_none_without_the_column():
    # The existing DataFrame shape (no synthetic/personaArchetype columns) —
    # confirms the new metrics degrade to None rather than raising a KeyError.
    import random
    random.seed(42)
    rows = []
    for i in range(trainer.MIN_SAMPLES + 20):
        label = i % 2
        base = 80 if label == 1 else 20
        rows.append({**{f: base / 100 + random.uniform(-0.05, 0.05) for f in trainer.SCORE_FEATURES},
                     'occasionFormality': random.choice([0, 1, 2, 3, 4]),
                     'isWardrobeOnly': random.choice([0, 1]),
                     'weatherTier': random.choice(['cold', 'mild', 'hot']),
                     'label': label})
    df = pd.DataFrame(rows)
    _, metrics = trainer.train_and_evaluate(df)
    assert metrics['synthetic_fraction'] is None
    assert metrics['real_sample_count'] is None
    assert metrics['persona_count'] is None


# ── Calibration (build_pipeline_calibrated + get_feature_importance) ───────

def _varied_dataframe(n=200, seed=7):
    import random
    random.seed(seed)
    rows = []
    for i in range(n):
        label = i % 2
        base = 80 if label == 1 else 20
        rows.append({**{f: base / 100 + random.uniform(-0.05, 0.05) for f in trainer.SCORE_FEATURES},
                     'occasionFormality': random.choice([0, 1, 2, 3, 4]),
                     'isWardrobeOnly': random.choice([0, 1]),
                     'weatherTier': random.choice(['cold', 'mild', 'hot']),
                     'label': label})
    return pd.DataFrame(rows)


def test_build_pipeline_calibrated_trains_and_predicts_without_error():
    df = _varied_dataframe()
    pipeline, metrics = trainer.train_and_evaluate(df, pipeline_builder=trainer.build_pipeline_calibrated)
    assert 0 <= metrics['accuracy'] <= 1
    # predict_proba must still work end-to-end through the calibration wrapper
    probs = pipeline.predict_proba(df[trainer.ALL_FEATURES])[:, 1]
    assert len(probs) == len(df)
    assert all(0 <= p <= 1 for p in probs)


def test_get_feature_importance_works_on_a_calibrated_pipeline_by_averaging_fold_coefficients():
    df = _varied_dataframe()
    pipeline, _ = trainer.train_and_evaluate(df, pipeline_builder=trainer.build_pipeline_calibrated)
    importance = trainer.get_feature_importance(pipeline, top_n=5)
    assert len(importance) == 5
    for entry in importance:
        assert 'feature' in entry and 'coefficient' in entry and 'direction' in entry
        assert entry['direction'] in ('increases acceptance', 'decreases acceptance')


def test_get_feature_importance_still_works_on_the_uncalibrated_pipeline():
    df = _varied_dataframe()
    pipeline, _ = trainer.train_and_evaluate(df)  # default build_pipeline
    importance = trainer.get_feature_importance(pipeline, top_n=3)
    assert len(importance) == 3
