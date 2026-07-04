// ── Shared confidence/score color scale ─────────────────────────────────────
// Previously duplicated (with silently drifting thresholds — 85/70, 80/65,
// 80/50, 70/45, 70/40 all appeared in different files for what was
// conceptually the same "is this score good?" question) across
// RecommendationPanel, DailyOutfitCard, XAIPanel, InsightsPanel, and
// Wardrobe. Single source of truth now.

// Outfit-recommendation confidence specifically — a deliberately stricter bar
// than generic completeness/utilization meters, since "confidence" is the
// core quality signal the whole recommendation engine is judged on.
const HIGH   = { text: 'Perfect Match', label: 'High',   color: '#059669', bg: '#dcfce7', border: '#bbf7d0' };
const MEDIUM = { text: 'Great Match',   label: 'Medium', color: '#d97706', bg: '#fef3c7', border: '#fde68a' };
const LOW    = { text: 'Good Match',    label: 'Low',    color: '#0ea5e9', bg: '#e0f2fe', border: '#bae6fd' };

export function getMatchBadge(confidence) {
  if (confidence >= 85) return HIGH;
  if (confidence >= 70) return MEDIUM;
  return LOW;
}

// Generic 0-100 "traffic light" scale for progress bars / meters — wardrobe
// completeness, calibration score, learning score, utilization rate, etc.
// A more lenient bar than match confidence: 70%+ genuinely counts as "good"
// for a completeness/utilization metric.
export function getMeterColor(percent, { good = 70, warn = 40 } = {}) {
  if (percent >= good) return '#059669';
  if (percent >= warn) return '#D97706';
  return '#DC2626';
}
