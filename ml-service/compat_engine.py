"""
compat_engine.py — Polyvore real-data compatibility model singleton, serving
side. Structural sibling of ml_engine.py, deliberately kept as a separate
file rather than folded into it: the acceptance-model pipeline (ml_engine.py)
stays completely untouched by this addition, which matters for being able to
show — including in a thesis defense — that the existing, already-tested
pipeline has zero diff.

Unlike ml_engine.py, this module has no retrain()/backup machinery: the
Polyvore dataset is static (it doesn't grow with this app's usage the way
Recommendation history does), so retraining is an occasional offline CLI
step (`npm run train:compat`, see polyvore_compat_trainer.py) whose output
gets loaded here — not a live, admin-triggerable HTTP action.
"""
import os
import logging

import joblib
import pandas as pd

import polyvore_compat_trainer as trainer

logger = logging.getLogger(__name__)

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'compat_model.pkl')

_pipeline = None  # singleton — loaded once at startup


def load():
    """Load the trained compatibility pipeline from disk (idempotent)."""
    global _pipeline
    if _pipeline is None:
        if not os.path.exists(MODEL_PATH):
            logger.warning('compat_model.pkl not found — run `npm run fetch:polyvore` then `npm run train:compat`.')
            return None
        try:
            _pipeline = joblib.load(MODEL_PATH)
            logger.info('Polyvore compatibility model loaded.')
        except Exception as e:
            logger.error('Failed to load compat model: %s', e)
    return _pipeline


def get_compat_predictions(samples: list) -> list:
    """
    Batch-predicts compatibility probability for a list of feature dicts
    (see polyvore_compat_trainer.ALL_FEATURES for the exact schema). Returns
    None if the model isn't loaded — caller treats this the same way
    mlBridgeService treats an unavailable acceptance model: a neutral
    fallback, not an error.
    """
    pipe = load()
    if pipe is None or not samples:
        return None
    try:
        df = pd.DataFrame(samples)
        for col in trainer.ALL_FEATURES:
            if col not in df.columns:
                df[col] = 0
        df = df[trainer.ALL_FEATURES]
        probs = pipe.predict_proba(df)[:, 1]
        return [{'datasetCompatProbability': round(float(p), 4)} for p in probs]
    except Exception as e:
        logger.error('Compat batch prediction error: %s', e)
        return None


def get_model_info():
    """Return model metadata dict for the /compat-model-info endpoint."""
    pipe = load()
    meta = _load_meta()
    return {
        'modelLoaded': pipe is not None,
        'modelExists': os.path.exists(MODEL_PATH),
        'algorithm':   meta.get('algorithm'),
        'trainingSize': meta.get('trainingSize'),
        'validationSize': meta.get('validationSize'),
        'testSize':    meta.get('testSize'),
        'testMetrics': meta.get('testMetrics'),
        'datasetSource': meta.get('datasetSource'),
        'negativeSamplingMethod': meta.get('negativeSamplingMethod'),
        'features':    trainer.ALL_FEATURES,
    }


def _load_meta():
    import json
    try:
        if os.path.exists(trainer.META_PATH):
            with open(trainer.META_PATH, 'r') as f:
                return json.load(f)
    except Exception:
        pass
    return {}
