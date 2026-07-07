# -*- coding: utf-8 -*-
"""
Unit tests for app.py's Flask routes via Flask's own test_client() — the one
piece of this service that was previously untested (only the underlying pure
functions in acceptance_trainer.py/ranking_metrics.py had coverage; the HTTP
layer itself — status codes, request parsing, error responses — did not).

Uses pytest's `monkeypatch` to stub ml_engine/ranking_metrics functions so
these tests need neither a real trained model nor a real MongoDB connection.
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
import app as flask_app_module
import ml_engine
import ranking_metrics


@pytest.fixture
def client():
    flask_app_module.app.config['TESTING'] = True
    return flask_app_module.app.test_client()


# ── /health ──────────────────────────────────────────────────────────────────

def test_health_reports_model_loaded_state(client, monkeypatch):
    monkeypatch.setattr(ml_engine, 'get_model_info', lambda: {'modelLoaded': True})
    res = client.get('/health')
    assert res.status_code == 200
    body = res.get_json()
    assert body['status'] == 'ok'
    assert body['modelLoaded'] is True


def test_health_reports_model_not_loaded(client, monkeypatch):
    monkeypatch.setattr(ml_engine, 'get_model_info', lambda: {'modelLoaded': False})
    res = client.get('/health')
    assert res.status_code == 200
    assert res.get_json()['modelLoaded'] is False


# ── /predict-acceptance-batch ────────────────────────────────────────────────

def test_predict_acceptance_batch_with_empty_samples_returns_empty_predictions(client):
    res = client.post('/predict-acceptance-batch', json={'samples': []})
    assert res.status_code == 200
    assert res.get_json() == {'predictions': []}


def test_predict_acceptance_batch_with_no_body_does_not_crash(client):
    res = client.post('/predict-acceptance-batch')
    assert res.status_code == 200
    assert res.get_json() == {'predictions': []}


def test_predict_acceptance_batch_returns_503_when_model_not_loaded(client, monkeypatch):
    monkeypatch.setattr(ml_engine, 'get_acceptance_predictions', lambda samples: None)
    res = client.post('/predict-acceptance-batch', json={'samples': [{'styleMatch': 0.5}]})
    assert res.status_code == 503
    assert res.get_json()['predictions'] == []


def test_predict_acceptance_batch_returns_predictions_when_model_loaded(client, monkeypatch):
    monkeypatch.setattr(ml_engine, 'get_acceptance_predictions', lambda samples: [{'acceptanceProbability': 0.77}])
    res = client.post('/predict-acceptance-batch', json={'samples': [{'styleMatch': 0.5}]})
    assert res.status_code == 200
    assert res.get_json()['predictions'] == [{'acceptanceProbability': 0.77}]


# ── /model-info ──────────────────────────────────────────────────────────────

def test_model_info_returns_the_full_metadata_dict(client, monkeypatch):
    fake_info = {'modelLoaded': True, 'accuracy': 0.77, 'algorithm': 'LogisticRegression'}
    monkeypatch.setattr(ml_engine, 'get_model_info', lambda: fake_info)
    res = client.get('/model-info')
    assert res.status_code == 200
    assert res.get_json() == fake_info


# ── /feature-importance ──────────────────────────────────────────────────────

def test_feature_importance_returns_503_when_unavailable(client, monkeypatch):
    monkeypatch.setattr(ml_engine, 'get_feature_importance', lambda top_n=20: [])
    res = client.get('/feature-importance')
    assert res.status_code == 503


def test_feature_importance_returns_features_and_count(client, monkeypatch):
    fake_features = [{'feature': 'occasionFit', 'coefficient': 1.2, 'direction': 'increases acceptance'}]
    monkeypatch.setattr(ml_engine, 'get_feature_importance', lambda top_n=20: fake_features)
    res = client.get('/feature-importance?top_n=5')
    assert res.status_code == 200
    body = res.get_json()
    assert body['count'] == 1
    assert body['features'] == fake_features


# ── /model-version ───────────────────────────────────────────────────────────

def test_model_version_returns_a_lightweight_subset(client, monkeypatch):
    monkeypatch.setattr(ml_engine, 'get_model_info', lambda: {
        'version': '1.0.3', 'trainedAt': '2026-01-01T00:00:00Z', 'accuracy': 0.8, 'modelLoaded': True,
    })
    res = client.get('/model-version')
    assert res.status_code == 200
    body = res.get_json()
    assert body == {'version': '1.0.3', 'trainedAt': '2026-01-01T00:00:00Z', 'accuracy': 0.8, 'loaded': True}


# ── /retrain ──────────────────────────────────────────────────────────────────

def test_retrain_success_returns_metrics(client, monkeypatch):
    monkeypatch.setattr(ml_engine, 'retrain', lambda: (True, {'accuracy': 0.8, 'trainingSize': 500}))
    res = client.post('/retrain')
    assert res.status_code == 200
    body = res.get_json()
    assert body['message'] == 'Model retrained successfully'
    assert body['metrics']['accuracy'] == 0.8


def test_retrain_cold_start_failure_returns_400_not_a_crash(client, monkeypatch):
    monkeypatch.setattr(ml_engine, 'retrain', lambda: (False, 'Insufficient data: need >= 50 labeled samples, have 12.'))
    res = client.post('/retrain')
    assert res.status_code == 400
    assert 'Insufficient data' in res.get_json()['error']


# ── /ranking-metrics ──────────────────────────────────────────────────────────

def test_ranking_metrics_returns_the_evaluation_result(client, monkeypatch):
    fake_result = {'ndcg_at_5_real': {'mean': None, 'n': 0}, 'diversity': {'mean': 0.6, 'n': 20}}

    class FakeClient:
        def get_default_database(self):
            class FakeDB:
                pass
            return FakeDB()

        def close(self):
            pass

    monkeypatch.setattr(flask_app_module, 'MongoClient', lambda uri: FakeClient())
    monkeypatch.setattr(ranking_metrics, 'evaluate_ranking_quality', lambda db: fake_result)

    res = client.get('/ranking-metrics')
    assert res.status_code == 200
    assert res.get_json() == fake_result


def test_ranking_metrics_returns_500_not_a_crash_on_db_failure(client, monkeypatch):
    def raise_connection_error(uri):
        raise Exception('Could not connect to MongoDB')

    monkeypatch.setattr(flask_app_module, 'MongoClient', raise_connection_error)
    res = client.get('/ranking-metrics')
    assert res.status_code == 500
    assert 'error' in res.get_json()
