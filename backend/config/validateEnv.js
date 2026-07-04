'use strict';

const { isDev } = require('./env');

// Extracted from server.js — startup configuration checks belong in config/,
// not inline in the app entrypoint.

module.exports = function validateEnv() {
  const critical = { MONGO_URI: 'MongoDB connection string', JWT_SECRET: 'JWT signing secret' };
  const missing  = Object.entries(critical).filter(([k]) => !process.env[k] || process.env[k].startsWith('your_'));

  if (missing.length) {
    console.error('\nStyleAI — Configuration Required\n');
    console.error('Missing required environment variables:\n');
    missing.forEach(([k, desc]) => console.error(`  ${k.padEnd(30)} ${desc}`));
    console.error('\nFix: open backend/.env and fill in the missing values.\n');
    process.exit(1);
  }

  // CORS origin in non-dev environments comes from CLIENT_URL (see server.js) —
  // if it's missing, every cross-origin request from the real frontend will be
  // silently blocked by the browser rather than failing with a clear error.
  if (!isDev && !process.env.CLIENT_URL) {
    console.warn('[StyleAI] CLIENT_URL is not set — CORS will block all cross-origin requests from your frontend in this environment.');
  }

  const aiKey = process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY;
  if (!aiKey) {
    console.warn('[StyleAI] No AI key set — AI Fashion Assistant will be disabled.');
    console.warn('[StyleAI] Add one of these to backend/.env:');
    console.warn('[StyleAI]   GEMINI_API_KEY    (free)  -> aistudio.google.com');
    console.warn('[StyleAI]   GROQ_API_KEY      (free)  -> console.groq.com');
    console.warn('[StyleAI]   ANTHROPIC_API_KEY (paid)  -> console.anthropic.com');
  } else {
    const provider = process.env.ANTHROPIC_API_KEY ? 'Anthropic Claude'
                   : process.env.GEMINI_API_KEY    ? 'Google Gemini'
                   : 'Groq';
    console.log(`[StyleAI] AI provider: ${provider}`);
  }

  const cloudVars = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  const missingCloud = cloudVars.filter(k => !process.env[k] || process.env[k] === '');
  if (missingCloud.length) {
    console.warn(`[StyleAI] Cloudinary not configured — image uploads disabled. Missing: ${missingCloud.join(', ')}`);
  }
};
