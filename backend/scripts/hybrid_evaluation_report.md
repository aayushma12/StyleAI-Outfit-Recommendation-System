# Hybrid vs. Rule-Only Evaluation Report

Generated: 2026-07-07T06:55:07.351Z

## 1. Retrospective — confidence-as-predictor discriminative power

Recomputes rule-only confidence (`scoringService.finalizeScore` with no ML
signal) from each historical recommendation's already-stored per-dimension
scores, and compares how well each version of "confidence" discriminates the
REAL recorded accept/reject outcome (ROC-AUC), on identical real data.

| Metric | Hybrid (rule + ML blend) | Rule-only |
|---|---|---|
| ROC-AUC | 0.8071 | 0.7914 |
| Sample size | 9154 | 9154 |

## 2. Live — diversity with ML on vs. forced off

Regenerated fresh sessions for 3 existing synthetic personas, once with the ML acceptance bridge on and once with it forced to `null` (the same fallback path used when the ML service is genuinely unreachable).

| Metric | With ML | Without ML (forced null) |
|---|---|---|
| Avg. within-session diversity | 1.0000 | 1.0000 |
| Personas evaluated | 3 | 3 |

**Known limitation — same as ranking_metrics.py's documented caveat**: synthetic persona sessions have no real wardrobe item references (`outfit.slot.item` is always `null`), so a diversity score computed on item-ID overlap is trivially 1.0 (no real IDs ever overlap). This half of the evaluation is not informative on synthetic data; it would need real user sessions with real wardrobe items to produce a meaningful reading. Reported honestly rather than presented as a real finding.
