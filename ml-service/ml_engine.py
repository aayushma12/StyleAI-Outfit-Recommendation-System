"""
ml_engine.py — Acceptance-probability model singleton for the StyleAI
deterministic recommendation pipeline. Loads acceptance_model.pkl once at
startup and exposes batch prediction + explainability utilities.

Replaces the old RandomForestClassifier outfit-label model, which was never
actually trained/evaluated in this environment (model_meta.json showed
accuracy: null). See acceptance_trainer.py for the full rationale and the
training pipeline itself.
"""
import os
import json
import shutil
import logging
from datetime import datetime

import joblib
import pandas as pd
from pymongo import MongoClient

import acceptance_trainer as trainer
import calibration_analysis

logger = logging.getLogger(__name__)

MODEL_PATH  = os.path.join(os.path.dirname(__file__), 'acceptance_model.pkl')
META_PATH   = os.path.join(os.path.dirname(__file__), 'model_meta.json')
BACKUP_DIR  = os.path.join(os.path.dirname(__file__), 'model_backups')

_pipeline = None  # singleton — loaded once at startup, hot-swapped on retrain


def load():
    """Load the trained acceptance-prediction pipeline from disk (idempotent)."""
    global _pipeline
    if _pipeline is None:
        if not os.path.exists(MODEL_PATH):
            logger.warning('acceptance_model.pkl not found — retrain to enable ML predictions.')
            return None
        try:
            _pipeline = joblib.load(MODEL_PATH)
            logger.info('Acceptance model loaded.')
        except Exception as e:
            logger.error('Failed to load model: %s', e)
    return _pipeline


def get_acceptance_predictions(samples: list) -> list:
    """
    Batch-predicts acceptance probability for a list of feature dicts
    (see acceptance_trainer.ALL_FEATURES for the exact schema Node sends).
    Returns None if the model isn't loaded — caller treats this as the
    documented neutral/cold-start fallback, not an error.
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
        return [{'acceptanceProbability': round(float(p), 4)} for p in probs]
    except Exception as e:
        logger.error('Batch prediction error: %s', e)
        return None


def get_feature_importance(top_n=20):
    pipe = load()
    if pipe is None:
        return []
    try:
        return trainer.get_feature_importance(pipe, top_n=top_n)
    except Exception as e:
        # Previously ungated — a corrupt/mismatched pickle here would propagate
        # as a raw unhandled 500 with a full stack trace out of /feature-importance.
        logger.error('Feature importance extraction failed: %s', e)
        return []


def get_model_info():
    """Return model metadata dict for the /model-info endpoint."""
    pipe = load()
    meta = _load_meta()

    return {
        'modelLoaded':  pipe is not None,
        'modelExists':  os.path.exists(MODEL_PATH),
        'version':      meta.get('version', '1.0.0'),
        'trainedAt':    meta.get('trainedAt', 'unknown'),
        'accuracy':     meta.get('accuracy'),
        'precision':    meta.get('precision'),
        'recall':       meta.get('recall'),
        'f1':           meta.get('f1'),
        'rocAuc':       meta.get('rocAuc'),
        'confusionMatrix': meta.get('confusionMatrix'),
        'trainingSize': meta.get('trainingSize'),
        'positiveRate': meta.get('positiveRate'),
        'syntheticFraction': meta.get('syntheticFraction'),
        'realSampleCount':   meta.get('realSampleCount'),
        'personaCount':      meta.get('personaCount'),
        'algorithmComparison': meta.get('algorithmComparison'),
        'brierScore':        meta.get('brierScore'),
        'calibrationMethod': meta.get('calibrationMethod', 'none'),
        'calibrationBins':   meta.get('calibrationBins'),
        'algorithm':    meta.get('algorithm', 'LogisticRegression (class_weight=balanced, max_iter=1000)'),
        'encoding':     'OneHotEncoder for weatherTier + passthrough for the 9 scoring dimensions',
        'features':     trainer.ALL_FEATURES,
        'minSamplesRequired': trainer.MIN_SAMPLES,
    }


def _backup_current_model():
    """
    Copies the current model + metadata into model_backups/ before a retrain
    overwrites them in place. Without this, a retrain on a bad/skewed data
    batch had no recovery path — the only history was whatever metrics
    happened to be in model_meta.json, and that gets overwritten too.
    No-op on the very first training run (nothing to back up yet).
    """
    if not os.path.exists(MODEL_PATH):
        return
    os.makedirs(BACKUP_DIR, exist_ok=True)
    meta = _load_meta()
    version = meta.get('version', '1.0.0')
    timestamp = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
    shutil.copy2(MODEL_PATH, os.path.join(BACKUP_DIR, f'acceptance_model_{version}_{timestamp}.pkl'))
    if os.path.exists(META_PATH):
        shutil.copy2(META_PATH, os.path.join(BACKUP_DIR, f'model_meta_{version}_{timestamp}.json'))
    logger.info('Backed up current model (version %s) to %s before retraining.', version, BACKUP_DIR)


def retrain():
    """
    Retrains the acceptance model from real MongoDB usage data.
    Returns (success: bool, result: dict | error_str). On insufficient data,
    returns a clean, documented failure — never crashes the service.
    """
    global _pipeline

    mongo_uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017/outfit_recommendation')
    client = MongoClient(mongo_uri)
    db = client.get_default_database()

    # Deployed-algorithm switch — defaults to Logistic Regression. Flip via
    # ML_ALGORITHM=gradient_boosting to deploy the GB pipeline instead; see
    # acceptance_trainer.compare_algorithms for the data-driven recommendation
    # of which one to actually pick (informational — doesn't auto-switch this).
    algorithm = os.getenv('ML_ALGORITHM', 'logistic_regression')
    # Calibration correction — opt-in, off by default. calibration_analysis.py's
    # real, measured verdict on this project's data: raw-model Brier score
    # 0.183, below the 0.20 "meaningfully miscalibrated" threshold used there —
    # an "adequate, not broken" finding, so not applied automatically. Still a
    # real, fully-tested capability (CALIBRATE_MODEL=true) since the
    # reliability diagram shows a genuine, if modest, underconfidence pattern.
    calibrate = os.getenv('CALIBRATE_MODEL', 'false').lower() == 'true'

    if calibrate and algorithm != 'gradient_boosting':
        pipeline_builder = trainer.build_pipeline_calibrated
        algorithm_label = f"LogisticRegression + CalibratedClassifierCV({os.getenv('CALIBRATION_METHOD', 'sigmoid')})"
    elif algorithm == 'gradient_boosting':
        pipeline_builder = trainer.build_pipeline_gb
        algorithm_label = 'GradientBoostingClassifier (n_estimators=150, max_depth=3, learning_rate=0.05)'
    else:
        pipeline_builder = trainer.build_pipeline
        algorithm_label = 'LogisticRegression (class_weight=balanced, max_iter=1000)'

    try:
        df = trainer.load_training_data(db)
        trainer.inspect_dataset(df)

        pipeline, metrics = trainer.train_and_evaluate(df, pipeline_builder=pipeline_builder)
        trainer.print_evaluation(metrics)

        # Documented LR-vs-GB comparison via k-fold CV — reported for
        # transparency regardless of which algorithm is actually deployed;
        # degrades to {'available': False, ...} on a still-small dataset
        # rather than failing the whole retrain.
        algorithm_comparison = trainer.compare_algorithms(df)

        # Real, measured calibration — the raw (uncalibrated) model's
        # out-of-fold Brier score, reported every retrain regardless of
        # whether CALIBRATE_MODEL is on, so the admin panel always shows an
        # honest, current number rather than a stale one-off measurement.
        try:
            calibration_result = calibration_analysis.evaluate_raw_model_calibration(df)
        except Exception as e:
            logger.warning('Calibration analysis skipped: %s', e)
            calibration_result = None

        _backup_current_model()
        trainer.save_model(pipeline, MODEL_PATH)

        _pipeline = pipeline  # hot-swap singleton

        meta = {
            'version':      _bump(_load_meta().get('version', '1.0.0')),
            'trainedAt':    datetime.utcnow().isoformat() + 'Z',
            'accuracy':     round(float(metrics['accuracy']), 4),
            'precision':    round(float(metrics['precision']), 4),
            'recall':       round(float(metrics['recall']), 4),
            'f1':           round(float(metrics['f1']), 4),
            'rocAuc':       round(float(metrics['roc_auc']), 4) if metrics['roc_auc'] is not None else None,
            'confusionMatrix': metrics['confusion_matrix'],
            'trainingSize': metrics['training_size'],
            'positiveRate': round(float(metrics['positive_rate']), 4),
            'syntheticFraction': round(float(metrics['synthetic_fraction']), 4) if metrics.get('synthetic_fraction') is not None else None,
            'realSampleCount':   metrics.get('real_sample_count'),
            'personaCount':      metrics.get('persona_count'),
            'algorithm':          algorithm_label,
            'algorithmComparison': algorithm_comparison,
            'brierScore':         calibration_result.get('brierScore') if calibration_result else None,
            'calibrationMethod':  (f"platt ({os.getenv('CALIBRATION_METHOD', 'sigmoid')})" if calibrate else 'none'),
            'calibrationBins':    calibration_result.get('bins') if calibration_result else None,
        }
        _save_meta(meta)
        logger.info('Retrain complete — version %s, accuracy %.4f, trainingSize %d.',
                     meta['version'], meta['accuracy'], meta['trainingSize'])
        return True, meta

    except ValueError as e:
        # Documented cold-start case (not enough labeled data yet) — not a crash.
        logger.warning('Retrain skipped (cold start): %s', e)
        return False, str(e)
    except Exception as e:
        logger.error('Retrain failed: %s', e)
        return False, str(e)
    finally:
        client.close()


# ── helpers ───────────────────────────────────────────────────────────────────

def _load_meta():
    try:
        if os.path.exists(META_PATH):
            with open(META_PATH, 'r') as f:
                return json.load(f)
    except Exception:
        pass
    return {}


def _save_meta(meta):
    with open(META_PATH, 'w') as f:
        json.dump(meta, f, indent=2)


def _bump(version_str):
    parts = version_str.split('.')
    parts[-1] = str(int(parts[-1]) + 1)
    return '.'.join(parts)
