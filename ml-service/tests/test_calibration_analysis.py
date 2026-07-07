# -*- coding: utf-8 -*-
"""
Unit tests for calibration_analysis.py. The displayed-confidence tests
construct exact confidence/status pairs via the same FakeDB/FakeCollection
pattern already used in test_acceptance_trainer.py, so a "well-calibrated" or
"poorly-calibrated" scenario is deterministic and directly verifiable —
rather than relying on indirect model-training behavior, which can't
reliably be steered to a specific Brier score on demand.
"""
import sys
import os
import random

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import calibration_analysis as calib
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


def make_training_doc(confidence, accepted, occasion='daily'):
    return {
        'scores': make_scores(confidence), 'status': 'liked' if accepted else 'disliked',
        'userRating': None, 'occasion': occasion, 'wardrobeOnly': False, 'weatherTemp': 20,
    }


# ── evaluate_displayed_confidence_calibration — deterministic scenarios ─────

def test_well_calibrated_confidence_scores_a_low_brier_and_is_flagged_well_calibrated():
    docs = []
    # Confidence buckets whose actual acceptance rate matches the confidence
    # almost exactly, kept away from the noisy 50% midpoint (a genuinely
    # well-calibrated prediction near 0.5 still carries an irreducible Brier
    # contribution from real outcome variance — this scenario isolates
    # calibration quality from that inherent noise floor).
    for conf, accept_rate in [(0.05, 0.05), (0.15, 0.15), (0.85, 0.85), (0.95, 0.95)]:
        n_accept = round(accept_rate * 50)
        for i in range(50):
            docs.append({'confidence': conf * 100, 'status': 'liked' if i < n_accept else 'disliked'})
    db = FakeDB(docs)

    result = calib.evaluate_displayed_confidence_calibration(db)

    assert result['available'] is True
    assert result['brierScore'] < 0.15
    assert result['wellCalibrated'] is True
    assert result['sampleSize'] == 200


def test_poorly_calibrated_confidence_scores_a_high_brier_and_is_flagged_miscalibrated():
    docs = []
    # Confidence always claims 90%, but real acceptance is only ~10% — a
    # textbook overconfident, badly miscalibrated case.
    for i in range(100):
        docs.append({'confidence': 90, 'status': 'liked' if i < 10 else 'disliked'})
    db = FakeDB(docs)

    result = calib.evaluate_displayed_confidence_calibration(db)

    assert result['available'] is True
    assert result['brierScore'] > calib.MISCALIBRATION_BRIER_THRESHOLD
    assert result['wellCalibrated'] is False


def test_reports_unavailable_with_too_few_actioned_samples():
    docs = [{'confidence': 70, 'status': 'liked'} for _ in range(5)]
    db = FakeDB(docs)

    result = calib.evaluate_displayed_confidence_calibration(db)

    assert result['available'] is False
    assert 'reason' in result


def test_pending_status_rows_are_excluded_from_the_calculation():
    docs = (
        [{'confidence': 50, 'status': 'pending'} for _ in range(30)] +  # should be ignored
        [{'confidence': 70, 'status': 'liked'} for _ in range(15)] +
        [{'confidence': 70, 'status': 'disliked'} for _ in range(15)]
    )
    db = FakeDB(docs)

    result = calib.evaluate_displayed_confidence_calibration(db)

    assert result['sampleSize'] == 30  # only the 30 actioned rows count


# ── evaluate_raw_model_calibration — smoke test on a real small dataset ────

def test_evaluate_raw_model_calibration_returns_expected_shape():
    random.seed(42)
    docs = []
    for _ in range(300):
        quality = random.uniform(0.3, 0.9)
        accepted = random.random() < quality
        docs.append(make_training_doc(int(quality * 100), accepted))

    db = FakeDB(docs)
    df = trainer.load_training_data(db)

    result = calib.evaluate_raw_model_calibration(df)

    assert 0 <= result['brierScore'] <= 1
    assert len(result['bins']) <= calib.N_BINS
    assert result['sampleSize'] == len(df)
    assert isinstance(result['wellCalibrated'], bool)
