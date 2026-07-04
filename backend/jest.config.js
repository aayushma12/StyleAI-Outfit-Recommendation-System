'use strict';

module.exports = {
  forceExit: true, // mongodb-memory-server's binary process can otherwise keep Jest alive
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
      // mongodb-memory-server downloads a real MongoDB binary (~500-800MB) the
      // very first time it runs on a machine, then caches it permanently —
      // subsequent runs (including CI with a warm cache) take seconds, not
      // minutes. This generous timeout only matters for that one-time download.
      testTimeout: 300000,
    },
  ],
};
