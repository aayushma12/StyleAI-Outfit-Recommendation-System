import os
import sys
import time
import logging
from dotenv import load_dotenv
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from pymongo import MongoClient

load_dotenv()

logging.basicConfig(
    level=os.getenv('LOG_LEVEL', 'INFO').upper(),
    format='%(asctime)s [%(name)s] %(levelname)s: %(message)s',
    stream=sys.stdout,
)

import ml_engine  # noqa: E402 — imported after logging config so its module-level logger inherits it
import ranking_metrics  # noqa: E402 — same reasoning
import compat_engine  # noqa: E402 — same reasoning

logger = logging.getLogger(__name__)

app = Flask(__name__)
_allowed_origins = os.getenv('CORS_ORIGINS', 'http://localhost:5000,http://localhost:3000').split(',')
CORS(app, origins=_allowed_origins)


# Request-level tracing — every call the backend makes to this service leaves
# a one-line record of method/path/status/duration, so a failure can be
# pinned to "the request never arrived" vs "arrived and errored" vs "arrived,
# succeeded, but was slow" without adding logging inside every route.
@app.before_request
def _log_request_start():
    g._start_time = time.monotonic()


@app.after_request
def _log_request_end(response):
    duration_ms = round((time.monotonic() - g.get('_start_time', time.monotonic())) * 1000, 1)
    logger.info('%s %s -> %s (%sms)', request.method, request.path, response.status_code, duration_ms)
    return response


# Pre-load the acceptance model at startup so the first request isn't slow.
if ml_engine.load() is None:
    logger.warning('Starting with no acceptance model loaded — /predict-acceptance-batch will return 503 until a model exists (run /retrain or the training script).')
else:
    logger.info('Acceptance model loaded successfully at startup.')

# Pre-load the Polyvore compatibility model too — independent of the
# acceptance model above, so one being missing never blocks the other.
if compat_engine.load() is None:
    logger.warning('Starting with no compat model loaded — /predict-compat-batch will return 503 until `npm run fetch:polyvore && npm run train:compat` has been run.')
else:
    logger.info('Polyvore compatibility model loaded successfully at startup.')


@app.route('/health', methods=['GET'])
def health():
    info = ml_engine.get_model_info()
    compat_info = compat_engine.get_model_info()
    return jsonify({
        'status': 'ok',
        'service': 'StyleAI Acceptance-Prediction ML Service',
        'modelLoaded': info['modelLoaded'],
        'compatModelLoaded': compat_info['modelLoaded'],
    })


# ── ML Endpoints ──────────────────────────────────────────────────────────────

@app.route('/predict-acceptance-batch', methods=['POST'])
def predict_acceptance_batch():
    """
    Batch acceptance-probability prediction for one recommendation session's
    worth of candidates in a single round trip (never per-candidate — see
    rankingService.js on the Node side for why that matters for latency).

    Body: { samples: [ {styleMatch, colorHarmony, colorPref, occasionFit,
                         weatherFit, behaviorSignal, bodyTypeMatch, fabricMatch,
                         trendScore, occasionFormality, weatherTier, isWardrobeOnly}, ... ] }
    """
    data = request.get_json(silent=True) or {}
    samples = data.get('samples', [])
    if not samples:
        logger.info('predict-acceptance-batch: empty samples array, nothing to predict.')
        return jsonify({'predictions': []})

    logger.info('predict-acceptance-batch: scoring %d sample(s).', len(samples))
    predictions = ml_engine.get_acceptance_predictions(samples)
    if predictions is None:
        logger.warning('predict-acceptance-batch: model unavailable or prediction failed for %d sample(s) — see prior error log line.', len(samples))
        return jsonify({'error': 'Model not loaded — retrain first.', 'predictions': []}), 503
    logger.info('predict-acceptance-batch: returned %d prediction(s).', len(predictions))
    return jsonify({'predictions': predictions})


@app.route('/model-info', methods=['GET'])
def model_info():
    """Model metadata including accuracy/precision/recall/F1/ROC-AUC/confusion matrix."""
    return jsonify(ml_engine.get_model_info())


# ── Polyvore compatibility model endpoints ──────────────────────────────────
# Independent second signal — see compat_engine.py / polyvore_compat_trainer.py.
# No /retrain-compat route: the Polyvore dataset is static, so retraining is
# an occasional offline CLI step (`npm run train:compat`), not a live action.

@app.route('/predict-compat-batch', methods=['POST'])
def predict_compat_batch():
    """
    Batch dataset-compatibility-probability prediction, same one-round-trip-
    per-session shape as /predict-acceptance-batch.

    Body: { samples: [ {numItems, numTops, numBottoms, numDresses, numFootwear,
                         numAccessories, categoryDiversity, hasDressAndBottom,
                         numColorsDetected, numNeutralColors, numNonNeutralColors,
                         hasMultipleHues, avgPairwiseHueDistance, minPairwiseHueDistance}, ... ] }
    """
    data = request.get_json(silent=True) or {}
    samples = data.get('samples', [])
    if not samples:
        logger.info('predict-compat-batch: empty samples array, nothing to predict.')
        return jsonify({'predictions': []})

    logger.info('predict-compat-batch: scoring %d sample(s).', len(samples))
    predictions = compat_engine.get_compat_predictions(samples)
    if predictions is None:
        logger.warning('predict-compat-batch: model unavailable or prediction failed for %d sample(s).', len(samples))
        return jsonify({'error': 'Compat model not loaded — run `npm run train:compat`.', 'predictions': []}), 503
    logger.info('predict-compat-batch: returned %d prediction(s).', len(predictions))
    return jsonify({'predictions': predictions})


@app.route('/compat-model-info', methods=['GET'])
def compat_model_info():
    """Polyvore compat model metadata — algorithm, real test-set metrics, dataset provenance."""
    return jsonify(compat_engine.get_model_info())


@app.route('/feature-importance', methods=['GET'])
def feature_importance():
    """Signed logistic-regression coefficients — which features push acceptance up/down."""
    top_n  = int(request.args.get('top_n', 20))
    result = ml_engine.get_feature_importance(top_n=top_n)
    if not result:
        return jsonify({'error': 'Model not loaded or no features available'}), 503
    return jsonify({'features': result, 'count': len(result)})


@app.route('/model-version', methods=['GET'])
def model_version():
    """Lightweight version check endpoint."""
    info = ml_engine.get_model_info()
    return jsonify({
        'version':   info.get('version', 'unknown'),
        'trainedAt': info.get('trainedAt', 'unknown'),
        'accuracy':  info.get('accuracy'),
        'loaded':    info.get('modelLoaded', False),
    })


@app.route('/retrain', methods=['POST'])
def retrain():
    """
    Admin-triggered model retraining from real MongoDB usage data (not a CSV
    path — the acceptance model learns from this app's own Recommendation
    history). Reloads the model singleton in-process after training completes.
    """
    success, result = ml_engine.retrain()
    if success:
        return jsonify({'message': 'Model retrained successfully', 'metrics': result})
    return jsonify({'error': result}), 400


@app.route('/ranking-metrics', methods=['GET'])
def ranking_metrics_endpoint():
    """
    Ranking-quality evaluation (NDCG@5 for real vs. synthetic sessions,
    diversity, personalization) — separate from /model-info's classification
    metrics, since this is fundamentally a ranking problem. See
    ranking_metrics.py's module docstring for known limitations.
    """
    mongo_uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017/outfit_recommendation')
    client = None
    try:
        client = MongoClient(mongo_uri)
        db = client.get_default_database()
        return jsonify(ranking_metrics.evaluate_ranking_quality(db))
    except Exception as e:
        logging.getLogger(__name__).error('Ranking metrics computation failed: %s', e)
        return jsonify({'error': str(e)}), 500
    finally:
        if client is not None:
            client.close()


if __name__ == '__main__':
    port = int(os.getenv('PORT', 8000))
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_DEBUG', 'false').lower() == 'true')
