import os
import sys
import logging
from dotenv import load_dotenv
from flask import Flask, request, jsonify
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

app = Flask(__name__)
_allowed_origins = os.getenv('CORS_ORIGINS', 'http://localhost:5000,http://localhost:3000').split(',')
CORS(app, origins=_allowed_origins)

# Pre-load the acceptance model at startup so the first request isn't slow.
ml_engine.load()


@app.route('/health', methods=['GET'])
def health():
    info = ml_engine.get_model_info()
    return jsonify({
        'status': 'ok',
        'service': 'StyleAI Acceptance-Prediction ML Service',
        'modelLoaded': info['modelLoaded'],
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
        return jsonify({'predictions': []})

    predictions = ml_engine.get_acceptance_predictions(samples)
    if predictions is None:
        return jsonify({'error': 'Model not loaded — retrain first.', 'predictions': []}), 503
    return jsonify({'predictions': predictions})


@app.route('/model-info', methods=['GET'])
def model_info():
    """Model metadata including accuracy/precision/recall/F1/ROC-AUC/confusion matrix."""
    return jsonify(ml_engine.get_model_info())


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
    client = MongoClient(mongo_uri)
    try:
        db = client.get_default_database()
        return jsonify(ranking_metrics.evaluate_ranking_quality(db))
    except Exception as e:
        logging.getLogger(__name__).error('Ranking metrics computation failed: %s', e)
        return jsonify({'error': str(e)}), 500
    finally:
        client.close()


if __name__ == '__main__':
    port = int(os.getenv('PORT', 8000))
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_DEBUG', 'false').lower() == 'true')
