'use strict';

// Global Jest setup — runs once per test file (setupFilesAfterEnv).
// Spins up an isolated in-memory MongoDB so tests never touch the real
// development database, and wipes all collections between tests so they
// don't leak state into each other.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-jwt-secret-not-for-production';

// The real backend/.env may have live SMTP credentials configured (Mailtrap).
// Force them off during tests as a blanket guard against any code path
// (currently just the forgot-password flow, which is always mocked directly
// in auth.test.js) attempting a real network send during a test run — slow,
// flaky, and burns real send quota. This must run before app.js's
// `require('dotenv').config()` executes (Jest runs setupFilesAfterEnv before
// the test file's own top-level requires), and dotenv only fills in variables
// that are still `undefined`, so setting these to '' here beats dotenv to it.
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// jest.config.js's per-project `testTimeout: 300000` does not reliably apply
// to individual tests in this Jest version's multi-project mode, which left
// bcrypt-heavy auth-flow tests (register/login, several rounds each) prone to
// spuriously exceeding the 5000ms default under load. Raise the real default
// here instead — 30s is generous for any single test while nowhere near the
// 300s reserved below for the one-time MongoDB binary download.
jest.setTimeout(30000);

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}, 300000);

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map(c => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});
