'use strict';

// Shared "last N months" bucketing — previously implemented independently
// (with identical date math) in adminController.getAnalytics and
// adminController.getRecAnalytics. Always returns exactly `n` entries,
// oldest first, one per calendar month, regardless of whether any activity
// falls in a given month — callers that need a sparse (present-months-only)
// result, like historyController's aggregation-pipeline version, aren't a
// fit for this shape and are left as their own implementation.

function monthLabel(date) {
  return date.toLocaleString('en-US', { month: 'short' });
}

function getLastNMonthRanges(n = 6) {
  const now = new Date();
  const ranges = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
    ranges.push({ start, end, label: monthLabel(start) });
  }
  return ranges;
}

module.exports = { getLastNMonthRanges, monthLabel };
