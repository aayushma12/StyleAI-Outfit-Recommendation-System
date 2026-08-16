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
// Two independent breaker instances — an outage of just the compat model's
// endpoint must never trip the breaker for the already-working acceptance-
// model calls, and vice versa. Sharing one CB object across both would
// couple two unrelated failure domains.
function makeBreaker() {
  return {
    state:       'CLOSED', // CLOSED | OPEN | HALF_OPEN
    failures:    0,
    successes:   0,
    openedAt:    null,
    lastCheckAt: null,
  };
}

const CB         = makeBreaker();
const CB_COMPAT   = makeBreaker();

function cbAllow(cb) {
  if (cb.state === 'CLOSED') return true;
  if (cb.state === 'OPEN') {
    if (Date.now() - cb.openedAt > OPEN_WAIT) {
      cb.state = 'HALF_OPEN';
      return true;
    }
    return false;
  }
  // HALF_OPEN — allow one probe
  return true;
}

function cbSuccess(cb) {
  cb.successes++;
  cb.lastCheckAt = new Date();
  if (cb.state === 'HALF_OPEN') {
    cb.state    = 'CLOSED';
    cb.failures = 0;
  }
}

function cbFailure(cb) {
  cb.failures++;
  cb.lastCheckAt = new Date();
  if (cb.state === 'HALF_OPEN' || cb.failures >= MAX_FAILS) {
    cb.state    = 'OPEN';
    cb.openedAt = Date.now();
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
  if (!cbAllow(CB)) return ACCEPTANCE_FALLBACK;
  try {
    const data = await httpPost('/predict-acceptance-batch', { samples: featureBatch });
    cbSuccess(CB);
    return { available: true, predictions: data.predictions || [] };
  } catch (err) {
    cbFailure(CB);
    console.warn('[mlBridge] predictAcceptance failed:', err.message);
    return ACCEPTANCE_FALLBACK;
  }
};

// ── Public: predictCompat (batch) ─────────────────────────────────────────────
// Independent second signal from the Polyvore-trained compatibility model
// (see ml-service/compat_engine.py, ml-service/POLYVORE_COMPAT.md). Same
// always-resolves/never-throws discipline as predictAcceptance, but its own
// circuit breaker (CB_COMPAT) so the two endpoints fail independently.
const COMPAT_FALLBACK = { available: false, predictions: [] };

exports.predictCompat = async function predictCompat(featureBatch = []) {
  if (!featureBatch.length) return COMPAT_FALLBACK;
  if (!cbAllow(CB_COMPAT)) return COMPAT_FALLBACK;
  try {
    const data = await httpPost('/predict-compat-batch', { samples: featureBatch });
    cbSuccess(CB_COMPAT);
    return { available: true, predictions: data.predictions || [] };
  } catch (err) {
    cbFailure(CB_COMPAT);
    console.warn('[mlBridge] predictCompat failed:', err.message);
    return COMPAT_FALLBACK;
  }
};

// ── Public: getHealth ─────────────────────────────────────────────────────────
exports.getHealth = function getHealth() {
  const describe = (cb) => ({
    state:       cb.state,
    failures:    cb.failures,
    successes:   cb.successes,
    openedAt:    cb.openedAt ? new Date(cb.openedAt).toISOString() : null,
    lastCheckAt: cb.lastCheckAt,
  });
  return {
    ...describe(CB),
    compat: describe(CB_COMPAT),
    mlUrl:  ML_URL(),
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

// ── Public: getCompatModelMetrics ──────────────────────────────────────────────
// Proxies the Python service's /compat-model-info — real test-set metrics for
// the Polyvore-trained compatibility model, dataset provenance included.
exports.getCompatModelMetrics = async function getCompatModelMetrics() {
  try {
    const { data } = await axios.get(`${ML_URL()}/compat-model-info`, { timeout: 5000 });
    return { reachable: true, ...data };
  } catch (err) {
    return { reachable: false, error: err.message };
  }
};
