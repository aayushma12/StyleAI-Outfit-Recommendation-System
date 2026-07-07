'use strict';

// ── Hybrid vs. rule-only quantitative evaluation ────────────────────────────
// Answers "does blending the ML acceptance signal into confidence actually
// help?" in two honest, distinct halves:
//
// 1. Retrospective (real historical data, no regeneration): recomputes what
//    confidence WOULD have been with the ML signal forced off, from each
//    historical recommendation's already-stored per-dimension scores, and
//    compares how well each version discriminates the REAL recorded outcome
//    (ROC-AUC of confidence-as-predictor). Needs no new data.
// 2. Live (existing synthetic personas only): regenerates a small fixed
//    sample of sessions with the ML bridge on vs. forced off, and compares
//    within-session diversity — this can't be done retrospectively since the
//    original candidate pool isn't persisted (see recommendationEngine.js's
//    runPipeline / the plan's documented scope decision on this).
//
// Usage: node scripts/evaluateHybridVsRuleOnly.js [personaSampleSize=5]

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Recommendation = require('../models/Recommendation');
const User = require('../models/User');
const scoring = require('../services/scoringService');
const recommendationEngine = require('../services/recommendationEngine');
const mlBridge = require('../services/mlBridgeService');

// Stored Recommendation.scores field name -> live scoringService dimension
// key. Mirrors ml-service/acceptance_trainer.py's STORED_SCORE_TO_FEATURE
// mapping exactly — the same documented, deliberate naming difference
// (colorPreference on the schema, colorPref in live scoring code).
const STORED_TO_LIVE = {
  styleMatch: 'styleMatch', colorHarmony: 'colorHarmony', colorPreference: 'colorPref',
  occasionFit: 'occasionFit', weatherFit: 'weatherFit', behaviorSignal: 'behaviorSignal',
  bodyTypeMatch: 'bodyTypeMatch', fabricMatch: 'fabricMatch', trendScore: 'trendScore',
};

function toLiveScores(storedScores) {
  const out = {};
  for (const [stored, live] of Object.entries(STORED_TO_LIVE)) {
    out[live] = (storedScores?.[stored] ?? 70) / 100;
  }
  return out;
}

// Standard rank-based ROC-AUC (Mann-Whitney U statistic, with tie-averaged
// ranks) — self-contained rather than adding a new dependency for a one-off
// analysis script.
function rocAuc(scores, labels) {
  const n = scores.length;
  const nPos = labels.filter(l => l === 1).length;
  const nNeg = n - nPos;
  if (nPos === 0 || nNeg === 0) return null;

  const indexed = scores.map((s, i) => ({ s, label: labels[i] })).sort((a, b) => a.s - b.s);
  const ranks = new Array(n);
  let i = 0, rank = 1;
  while (i < n) {
    let j = i;
    while (j + 1 < n && indexed[j + 1].s === indexed[i].s) j++;
    const avgRank = (rank + (rank + (j - i))) / 2;
    for (let k = i; k <= j; k++) ranks[k] = avgRank;
    rank += (j - i + 1);
    i = j + 1;
  }
  let sumRanksPos = 0;
  for (let k = 0; k < n; k++) if (indexed[k].label === 1) sumRanksPos += ranks[k];
  return (sumRanksPos - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
}

async function retrospectiveHalf() {
  const sessions = await Recommendation.find({ 'recommendations.status': { $ne: 'pending' } })
    .select('recommendations.category recommendations.status recommendations.scores recommendations.confidence')
    .lean();

  const hybridConf = [], ruleConf = [], labels = [];
  for (const session of sessions) {
    for (const rec of session.recommendations || []) {
      if (rec.status === 'pending') continue;
      const label = ['worn', 'saved', 'liked'].includes(rec.status) ? 1 : 0;
      const liveScores = toLiveScores(rec.scores);
      const { confidence: ruleOnlyConfidence } = scoring.finalizeScore(liveScores, rec.category, null);
      hybridConf.push((rec.confidence || 50) / 100);
      ruleConf.push(ruleOnlyConfidence / 100);
      labels.push(label);
    }
  }

  const hybridAucRaw = rocAuc(hybridConf, labels);
  const ruleAucRaw   = rocAuc(ruleConf, labels);

  return {
    sampleSize: labels.length,
    hybridRocAuc:   hybridAucRaw !== null ? Math.round(hybridAucRaw * 10000) / 10000 : null,
    ruleOnlyRocAuc: ruleAucRaw   !== null ? Math.round(ruleAucRaw   * 10000) / 10000 : null,
  };
}

function jaccard(idsA, idsB) {
  const setA = new Set(idsA), setB = new Set(idsB);
  if (!setA.size && !setB.size) return 0;
  let inter = 0;
  for (const id of setA) if (setB.has(id)) inter++;
  return inter / new Set([...setA, ...setB]).size;
}

function sessionDiversity(recs) {
  const idSets = (recs || []).map(r =>
    Object.values(r.outfit || {}).map(s => s.item).filter(Boolean).map(String)
  );
  if (idSets.length < 2) return null;
  let total = 0, pairs = 0;
  for (let i = 0; i < idSets.length; i++) {
    for (let j = i + 1; j < idSets.length; j++) { total += 1 - jaccard(idSets[i], idSets[j]); pairs++; }
  }
  return pairs ? total / pairs : null;
}

async function liveHalf(personaSampleSize) {
  const personas = await User.find({ isSyntheticPersona: true }).limit(personaSampleSize).lean();
  if (!personas.length) {
    return { available: false, reason: 'No synthetic persona users found — run `npm run seed:persona-data` first.' };
  }

  const originalPredict = mlBridge.predictAcceptance;
  const withMl = [], withoutMl = [];

  try {
    for (const persona of personas) {
      mlBridge.predictAcceptance = originalPredict;
      const on = await recommendationEngine.generateSession(persona, { occasion: 'daily', requestedBy: 'user' });
      withMl.push(sessionDiversity(on.recommendations));

      mlBridge.predictAcceptance = async () => ({ available: false, predictions: [] });
      const off = await recommendationEngine.generateSession(persona, { occasion: 'daily', requestedBy: 'user' });
      withoutMl.push(sessionDiversity(off.recommendations));
    }
  } finally {
    mlBridge.predictAcceptance = originalPredict; // always restore, even on error
  }

  const avg = arr => {
    const valid = arr.filter(v => v !== null);
    return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
  };

  return {
    available: true,
    personaCount: personas.length,
    avgDiversityWithMl:    avg(withMl),
    avgDiversityWithoutMl: avg(withoutMl),
  };
}

function buildMarkdownReport({ retrospective, live, generatedAt }) {
  return `# Hybrid vs. Rule-Only Evaluation Report

Generated: ${generatedAt}

## 1. Retrospective — confidence-as-predictor discriminative power

Recomputes rule-only confidence (\`scoringService.finalizeScore\` with no ML
signal) from each historical recommendation's already-stored per-dimension
scores, and compares how well each version of "confidence" discriminates the
REAL recorded accept/reject outcome (ROC-AUC), on identical real data.

| Metric | Hybrid (rule + ML blend) | Rule-only |
|---|---|---|
| ROC-AUC | ${retrospective.hybridRocAuc ?? 'n/a'} | ${retrospective.ruleOnlyRocAuc ?? 'n/a'} |
| Sample size | ${retrospective.sampleSize} | ${retrospective.sampleSize} |

## 2. Live — diversity with ML on vs. forced off

${live.available
    ? `Regenerated fresh sessions for ${live.personaCount} existing synthetic personas, once with the ML acceptance bridge on and once with it forced to \`null\` (the same fallback path used when the ML service is genuinely unreachable).\n\n| Metric | With ML | Without ML (forced null) |\n|---|---|---|\n| Avg. within-session diversity | ${live.avgDiversityWithMl?.toFixed(4) ?? 'n/a'} | ${live.avgDiversityWithoutMl?.toFixed(4) ?? 'n/a'} |\n| Personas evaluated | ${live.personaCount} | ${live.personaCount} |\n\n${live.avgDiversityWithMl === 1 && live.avgDiversityWithoutMl === 1 ? '**Known limitation — same as ranking_metrics.py\'s documented caveat**: synthetic persona sessions have no real wardrobe item references (`outfit.slot.item` is always `null`), so a diversity score computed on item-ID overlap is trivially 1.0 (no real IDs ever overlap). This half of the evaluation is not informative on synthetic data; it would need real user sessions with real wardrobe items to produce a meaningful reading. Reported honestly rather than presented as a real finding.' : ''}`
    : `Skipped: ${live.reason}`}
`;
}

async function main() {
  const personaSampleSize = Number(process.argv[2]) || 5;
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to Mongo. Running hybrid-vs-rule-only evaluation...\n');

  const retrospective = await retrospectiveHalf();
  console.log('=== Retrospective: confidence-as-predictor discriminative power ===');
  console.log(`Sample size: ${retrospective.sampleSize}`);
  console.log(`Hybrid (rule + ML blend) ROC-AUC: ${retrospective.hybridRocAuc}`);
  console.log(`Rule-only ROC-AUC:                ${retrospective.ruleOnlyRocAuc}`);

  const live = await liveHalf(personaSampleSize);
  console.log(`\n=== Live: diversity with ML on vs. forced off (${personaSampleSize} synthetic personas) ===`);
  if (live.available) {
    console.log(`Personas evaluated: ${live.personaCount}`);
    console.log(`Avg diversity WITH ML:    ${live.avgDiversityWithMl?.toFixed(4)}`);
    console.log(`Avg diversity WITHOUT ML: ${live.avgDiversityWithoutMl?.toFixed(4)}`);
  } else {
    console.log(`[SKIPPED] ${live.reason}`);
  }

  const report = { retrospective, live, generatedAt: new Date().toISOString() };
  const mdPath = path.join(__dirname, 'hybrid_evaluation_report.md');
  fs.writeFileSync(mdPath, buildMarkdownReport(report));
  console.log(`\nFull markdown report written to ${mdPath}`);

  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}

module.exports = { rocAuc, toLiveScores, sessionDiversity, jaccard, retrospectiveHalf, liveHalf };
