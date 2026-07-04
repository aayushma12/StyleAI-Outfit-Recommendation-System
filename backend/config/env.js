'use strict';

// ── Single source of truth for "are we in a relaxed (dev/test) environment?" ──
// Previously, rate limiting (server.js), CSP's upgradeInsecureRequests
// (server.js), CORS origin (server.js), and cookie `secure`/`sameSite`
// flags (authController.js) each independently re-checked
// `process.env.NODE_ENV === 'production'` — meaning an unset or misspelled
// NODE_ENV silently disabled multiple unrelated security controls at once,
// with no single place to fix or reason about the behavior.
//
// This module computes it once, fails SAFE (production-like: rate limited,
// secure cookies, HTTPS upgrade) for anything that isn't explicitly
// "development" or "test", and warns loudly if NODE_ENV isn't one of the
// three recognized values.

const RECOGNIZED_ENVS = ['development', 'test', 'production'];
const RELAXED_ENVS    = ['development', 'test'];

const nodeEnv = process.env.NODE_ENV;

if (!RECOGNIZED_ENVS.includes(nodeEnv)) {
  console.warn(`[StyleAI] NODE_ENV is "${nodeEnv || 'unset'}" — expected one of: ${RECOGNIZED_ENVS.join(', ')}.`);
  console.warn('[StyleAI] Defaulting to production-safe behavior (rate limiting ON, secure cookies ON, HTTPS upgrade ON) until this is fixed.');
}

exports.isDev  = RELAXED_ENVS.includes(nodeEnv);
exports.isProd = !exports.isDev;
