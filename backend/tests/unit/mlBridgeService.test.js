'use strict';

// Circuit-breaker state (CB/CB_COMPAT) is module-level singleton state inside
// mlBridgeService.js, not exported/resettable — every test gets a fully fresh
// module instance via jest.resetModules() + re-require so failures/successes
// from one test can never leak into the next.
jest.setTimeout(20000);

let mlBridge;
let axios;

beforeEach(() => {
  jest.resetModules();
  jest.mock('axios');
  axios = require('axios');
  mlBridge = require('../../services/mlBridgeService');
});

const SAMPLE_BATCH = [{ styleMatch: 0.8, colorHarmony: 0.7 }];

describe('mlBridgeService.predictAcceptance', () => {
  test('returns the unavailable fallback for an empty batch without calling axios', async () => {
    const result = await mlBridge.predictAcceptance([]);
    expect(result).toEqual({ available: false, predictions: [] });
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('returns available:true with the real predictions on success', async () => {
    axios.post.mockResolvedValue({ data: { predictions: [{ acceptanceProbability: 0.42 }] } });
    const result = await mlBridge.predictAcceptance(SAMPLE_BATCH);
    expect(result).toEqual({ available: true, predictions: [{ acceptanceProbability: 0.42 }] });
  });

  test('calls the /predict-acceptance-batch endpoint with a { samples } body', async () => {
    axios.post.mockResolvedValue({ data: { predictions: [] } });
    await mlBridge.predictAcceptance(SAMPLE_BATCH);
    const [url, body] = axios.post.mock.calls[0];
    expect(url).toContain('/predict-acceptance-batch');
    expect(body).toEqual({ samples: SAMPLE_BATCH });
  });

  test('never throws — persistent failure degrades to the fallback shape', async () => {
    axios.post.mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await mlBridge.predictAcceptance(SAMPLE_BATCH);
    expect(result).toEqual({ available: false, predictions: [] });
  });

  test('retries a failing call up to 3 attempts before giving up', async () => {
    axios.post
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValueOnce({ data: { predictions: [{ acceptanceProbability: 0.9 }] } });
    const result = await mlBridge.predictAcceptance(SAMPLE_BATCH);
    expect(axios.post).toHaveBeenCalledTimes(3);
    expect(result.available).toBe(true);
  });

  test('opens the circuit breaker after 5 consecutive failures and short-circuits further calls', async () => {
    axios.post.mockRejectedValue(new Error('down'));
    for (let i = 0; i < 5; i++) {
      await mlBridge.predictAcceptance(SAMPLE_BATCH);
    }
    expect(mlBridge.getHealth().state).toBe('OPEN');

    const callsBeforeOpen = axios.post.mock.calls.length;
    const result = await mlBridge.predictAcceptance(SAMPLE_BATCH);
    expect(result).toEqual({ available: false, predictions: [] });
    // Breaker is open — this call must not have hit axios.post at all.
    expect(axios.post.mock.calls.length).toBe(callsBeforeOpen);
  });
});

describe('mlBridgeService.predictCompat', () => {
  test('returns the unavailable fallback for an empty batch without calling axios', async () => {
    const result = await mlBridge.predictCompat([]);
    expect(result).toEqual({ available: false, predictions: [] });
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('returns available:true with the real predictions on success', async () => {
    axios.post.mockResolvedValue({ data: { predictions: [{ datasetCompatProbability: 0.55 }] } });
    const result = await mlBridge.predictCompat(SAMPLE_BATCH);
    expect(result).toEqual({ available: true, predictions: [{ datasetCompatProbability: 0.55 }] });
  });

  test('calls the /predict-compat-batch endpoint', async () => {
    axios.post.mockResolvedValue({ data: { predictions: [] } });
    await mlBridge.predictCompat(SAMPLE_BATCH);
    expect(axios.post.mock.calls[0][0]).toContain('/predict-compat-batch');
  });
});

describe('mlBridgeService — independent circuit breakers', () => {
  test('predictCompat failures never open predictAcceptance\'s breaker, and vice versa', async () => {
    axios.post.mockImplementation((url) => {
      if (url.includes('compat')) return Promise.reject(new Error('compat down'));
      return Promise.resolve({ data: { predictions: [{ acceptanceProbability: 0.5 }] } });
    });

    // Exhaust the compat breaker's failure budget.
    for (let i = 0; i < 5; i++) {
      await mlBridge.predictCompat(SAMPLE_BATCH);
    }

    const health = mlBridge.getHealth();
    expect(health.compat.state).toBe('OPEN');
    expect(health.state).toBe('CLOSED'); // acceptance breaker unaffected

    // The acceptance model must still work normally.
    const result = await mlBridge.predictAcceptance(SAMPLE_BATCH);
    expect(result.available).toBe(true);
  });
});

describe('mlBridgeService.getHealth', () => {
  test('reports a nested compat breaker alongside the top-level acceptance breaker', () => {
    const health = mlBridge.getHealth();
    expect(health).toMatchObject({
      state: 'CLOSED', failures: 0, successes: 0,
      compat: { state: 'CLOSED', failures: 0, successes: 0 },
    });
    expect(health.mlUrl).toEqual(expect.any(String));
  });
});

describe('mlBridgeService.getModelMetrics / getCompatModelMetrics', () => {
  test('getModelMetrics returns reachable:true with the proxied data on success', async () => {
    axios.get.mockResolvedValue({ data: { accuracy: 0.73, rocAuc: 0.81 } });
    const result = await mlBridge.getModelMetrics();
    expect(result).toEqual({ reachable: true, accuracy: 0.73, rocAuc: 0.81 });
  });

  test('getModelMetrics returns reachable:false on failure, never throws', async () => {
    axios.get.mockRejectedValue(new Error('unreachable'));
    const result = await mlBridge.getModelMetrics();
    expect(result.reachable).toBe(false);
  });

  test('getCompatModelMetrics returns reachable:true with the proxied data on success', async () => {
    axios.get.mockResolvedValue({ data: { algorithm: 'gradient_boosting', testMetrics: { rocAuc: 0.6089 } } });
    const result = await mlBridge.getCompatModelMetrics();
    expect(result).toEqual({ reachable: true, algorithm: 'gradient_boosting', testMetrics: { rocAuc: 0.6089 } });
  });

  test('getCompatModelMetrics returns reachable:false on failure, never throws', async () => {
    axios.get.mockRejectedValue(new Error('unreachable'));
    const result = await mlBridge.getCompatModelMetrics();
    expect(result.reachable).toBe(false);
  });
});
