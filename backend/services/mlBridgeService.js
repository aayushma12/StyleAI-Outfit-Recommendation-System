'use strict';

// ── Bridge to the Python acceptance-prediction ML service ───────────────────
// Retired: the old single-item /predict (RandomForest outfit-label classifier,
// never actually trained/evaluated) and getMlSignal's keyword-overlap hack.
// Replaced by one batched call per session to /predict-acceptance-batch,
// backed by a real, evaluated Logistic Regression model (see
// ml-service/acceptance_trainer.py).

const axios = require('axios');

const ML_URL    = () => process.env.ML_SERVICE_URL || 'http://localhost:8000';
const TIMEOUT    = 5000; // batch calls carry more samples than the old single-item /predict
const MAX_FAILS  = 5;
const OPEN_WAIT  = 60 * 1000; // 60s

// ── Circuit breaker state ─────────────────────────────────────────────────────
const CB = {
  state:       'CLOSED', // CLOSED | OPEN | HALF_OPEN
  failures:    0,
  successes:   0,
  openedAt:    null,
  lastCheckAt: null,
};

function cbAllow() {
  if (CB.state === 'CLOSED') return true;
  if (CB.state === 'OPEN') {
    if (Date.now() - CB.openedAt > OPEN_WAIT) {
      CB.state = 'HALF_OPEN';
      return true;
    }
    return false;
  }
  // HALF_OPEN — allow one probe
  return true;
}

function cbSuccess() {
  CB.successes++;
  CB.lastCheckAt = new Date();
  if (CB.state === 'HALF_OPEN') {
    CB.state    = 'CLOSED';
    CB.failures = 0;
  }
}

function cbFailure() {
  CB.failures++;
  CB.lastCheckAt = new Date();
  if (CB.state === 'HALF_OPEN' || CB.failures >= MAX_FAILS) {
    CB.state    = 'OPEN';
    CB.openedAt = Date.now();
  }
}

// ── HTTP helper with retry + backoff ─────────────────────────────────────────
async function httpPost(path, body, attempt = 1) {
  try {
    const res = await axios.post(`${ML_URL()}${path}`, body, { timeout: TIMEOUT });
    return res.data;
  } catch (err) {
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, attempt * 500));
      return httpPost(path, body, attempt + 1);
    }
    throw err;
  }
}

// ── Public: predictAcceptance (batch) ─────────────────────────────────────────
// One HTTP round-trip for an entire session's worth of candidates — never
// per-candidate. Always resolves; never throws. Cold-start / model-down /
// service-unreachable all collapse to the same clean "unavailable" shape,
// which rankingService/scoringService already treat as a neutral no-op
// (finalizeScore just skips the ML blend when mlAcceptanceProbability is null).
const ACCEPTANCE_FALLBACK = { available: false, predictions: [] };

exports.predictAcceptance = async function predictAcceptance(featureBatch = []) {
  if (!featureBatch.length) return ACCEPTANCE_FALLBACK;
  if (!cbAllow()) return ACCEPTANCE_FALLBACK;
  try {
    const data = await httpPost('/predict-acceptance-batch', { samples: featureBatch });
    cbSuccess();
    return { available: true, predictions: data.predictions || [] };
  } catch (err) {
    cbFailure();
    console.warn('[mlBridge] predictAcceptance failed:', err.message);
    return ACCEPTANCE_FALLBACK;
  }
};

// ── Public: getHealth ─────────────────────────────────────────────────────────
exports.getHealth = function getHealth() {
  return {
    state:       CB.state,
    failures:    CB.failures,
    successes:   CB.successes,
    openedAt:    CB.openedAt ? new Date(CB.openedAt).toISOString() : null,
    lastCheckAt: CB.lastCheckAt,
    mlUrl:       ML_URL(),
  };
};

// ── Public: getModelMetrics ────────────────────────────────────────────────────
// Proxies the Python service's /model-info — now returns real accuracy/
// precision/recall/F1/ROC-AUC/confusion-matrix from the trained acceptance
// model, instead of the always-null values the old RF model reported.
exports.getModelMetrics = async function getModelMetrics() {
  try {
    const { data } = await axios.get(`${ML_URL()}/model-info`, { timeout: 5000 });
    return { reachable: true, ...data };
  } catch (err) {
    return { reachable: false, error: err.message };
  }
};
