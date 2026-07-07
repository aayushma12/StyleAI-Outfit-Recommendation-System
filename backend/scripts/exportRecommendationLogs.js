'use strict';

// ── Structured recommendation log export ────────────────────────────────────
// Every field a recommendation-analytics table needs (user, timestamp,
// wizard params, weather, candidate count, ML probability, rule-based score,
// final score, what was shown, accepted/rejected status, feedback reason)
// was already persisted directly on Recommendation documents before this
// script existed — this just flattens one CSV row per shown recommendation
// for analysis/thesis inclusion, mirroring the existing admin CSV export
// pattern (adminController.js's exportUsers/exportRecommendations) rather
// than introducing a new logging system alongside it.
//
// Usage: node scripts/exportRecommendationLogs.js [outputPath]

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Recommendation = require('../models/Recommendation');

const HEADER = [
  'UserId', 'Timestamp', 'RequestedBy', 'Occasion', 'WizardDresscode', 'WizardBudget',
  'WizardIndoorOutdoor', 'WizardDayNight', 'WizardVibe', 'WeatherTempC', 'WeatherCondition',
  'CandidatePoolSize', 'Category', 'OutfitName', 'MlAcceptanceProbability', 'RuleScore',
  'FinalConfidence', 'Status', 'FeedbackReasons',
].join(',');

function csvField(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

async function main() {
  const outputPath = process.argv[2] || path.join(__dirname, `recommendation_logs_${Date.now()}.csv`);

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to Mongo. Exporting recommendation logs...');

  const sessions = await Recommendation.find({})
    .select('user context wizardContext generationMeta recommendations createdAt')
    .sort({ createdAt: -1 })
    .limit(20000)
    .lean();

  const rows = [];
  for (const s of sessions) {
    for (const r of s.recommendations || []) {
      rows.push([
        csvField(s.user),
        csvField(s.createdAt ? new Date(s.createdAt).toISOString() : ''),
        csvField(s.context?.requestedBy),
        csvField(s.context?.occasion),
        csvField(s.wizardContext?.dresscode),
        csvField(s.wizardContext?.budget),
        csvField(s.wizardContext?.indoorOutdoor),
        csvField(s.wizardContext?.dayNight),
        csvField(s.wizardContext?.vibe),
        csvField(s.context?.weather?.temp),
        csvField(s.context?.weather?.condition),
        csvField(s.generationMeta?.candidatePoolSize),
        csvField(r.category),
        csvField(r.outfitName),
        csvField(r.mlAcceptanceProbability),
        csvField(r.ruleScore),
        csvField(r.confidence),
        csvField(r.status),
        csvField((r.feedbackReasons || []).join('; ')),
      ].join(','));
    }
  }

  fs.writeFileSync(outputPath, [HEADER, ...rows].join('\n'));
  console.log(`Wrote ${rows.length} recommendation log rows from ${sessions.length} sessions to ${outputPath}`);

  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}

module.exports = { csvField, HEADER };
