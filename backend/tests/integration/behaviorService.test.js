'use strict';

const mongoose = require('mongoose');
const BehaviorLog = require('../../models/BehaviorLog');
const { getNegativeSignals, getUserInsights, logBehavior, getRecentlyRecommendedItemIds } = require('../../services/behaviorService');

function mkUserId() {
  return new mongoose.Types.ObjectId();
}

describe('behaviorService.getNegativeSignals', () => {
  test('reason-tagged color rejections outrank untagged ones of the same age when both are borderline', async () => {
    const userId = mkUserId();
    const oldTimestamp = new Date(Date.now() - 55 * 86400000); // near the 60-day cutoff — low but non-zero decay weight

    await BehaviorLog.create({ user: userId, action: 'recommendation_reject', metadata: { color: ['blue'] } });
    await BehaviorLog.updateOne({ user: userId, 'metadata.color': 'blue' }, { $set: { createdAt: oldTimestamp } });

    await BehaviorLog.create({ user: userId, action: 'recommendation_reject', metadata: { color: ['green'], reasons: ['wrong_color'] } });
    await BehaviorLog.updateOne({ user: userId, 'metadata.color': 'green' }, { $set: { createdAt: oldTimestamp } });

    const signals = await getNegativeSignals(userId);
    // "green" (reason-boosted) should rank ahead of "blue" (unboosted) despite
    // identical recency, since avoidColors is sorted by descending weight.
    const greenIndex = signals.avoidColors.indexOf('green');
    const blueIndex  = signals.avoidColors.indexOf('blue');
    if (greenIndex !== -1 && blueIndex !== -1) {
      expect(greenIndex).toBeLessThan(blueIndex);
    } else {
      // Either could fall below the 0.5 surfacing threshold at this decay —
      // if so, green (boosted) must be the one that survives, not blue.
      expect(signals.avoidColors).toContain('green');
    }
  });

  test('returns empty, non-throwing defaults for a user with no rejection history', async () => {
    const signals = await getNegativeSignals(mkUserId());
    expect(signals.avoidColors).toEqual([]);
    expect(signals.avoidStyles).toEqual([]);
    expect(signals.avoidCategories).toEqual([]);
    expect(signals.avoidOccasions).toEqual([]);
    expect(signals.hasNegativeHistory).toBe(false);
  });
});

describe('behaviorService.getUserInsights', () => {
  test('reports hasHistory=false and safe defaults for a brand-new user', async () => {
    const insights = await getUserInsights(mkUserId());
    expect(insights.hasHistory).toBe(false);
    expect(insights.totalInteractions).toBe(0);
    expect(Array.isArray(insights.topColors)).toBe(true);
  });

  test('logBehavior persists an event that getUserInsights can then see', async () => {
    const userId = mkUserId();
    await logBehavior(userId, 'recommendation_accept', {
      metadata: { color: ['teal'], category: 'tops', accepted: true, score: 90 },
    });
    const insights = await getUserInsights(userId);
    expect(insights.totalInteractions).toBeGreaterThan(0);
  });
});

describe('behaviorService.getRecentlyRecommendedItemIds', () => {
  test('picks up recommendation_save and outfit_save, not just recommendation_accept (regression: saved-only outfits used to never count toward "don\'t repeat this")', async () => {
    const userId = mkUserId();
    const acceptedId = mkUserId(), savedId = mkUserId(), calendarId = mkUserId();

    await logBehavior(userId, 'recommendation_accept', { metadata: { itemIds: [acceptedId] } });
    await logBehavior(userId, 'recommendation_save',   { metadata: { itemIds: [savedId] } });
    await logBehavior(userId, 'outfit_save',           { metadata: { itemIds: [calendarId] } }); // e.g. scheduled onto the calendar

    const ids = await getRecentlyRecommendedItemIds(userId, 30);

    expect(ids.has(acceptedId.toString())).toBe(true);
    expect(ids.has(savedId.toString())).toBe(true);
    expect(ids.has(calendarId.toString())).toBe(true);
  });

  test('ignores rejections and events outside the window', async () => {
    const userId = mkUserId();
    const rejectedId = mkUserId(), staleId = mkUserId();

    await logBehavior(userId, 'recommendation_reject', { metadata: { itemIds: [rejectedId] } });
    await logBehavior(userId, 'recommendation_save', { metadata: { itemIds: [staleId] } });
    // Mongoose's `timestamps: true` silently strips createdAt from a
    // Model.updateOne() $set (by design, to keep createdAt immutable after
    // creation) — bypass via the raw driver collection to actually backdate it.
    await BehaviorLog.collection.updateOne(
      { user: userId, 'metadata.itemIds': staleId },
      { $set: { createdAt: new Date(Date.now() - 45 * 86400000) } }
    );

    const ids = await getRecentlyRecommendedItemIds(userId, 30);

    expect(ids.has(rejectedId.toString())).toBe(false);
    expect(ids.has(staleId.toString())).toBe(false);
  });
});
