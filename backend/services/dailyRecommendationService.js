'use strict';

/**
 * Daily Recommendation Service
 *
 * Responsible for the "Today's Outfit" feature:
 *  1. Checks if a daily recommendation already exists for today (since midnight)
 *  2. If found, returns it immediately (fast path — no AI call)
 *  3. If not, enriches the context with:
 *       • Upcoming calendar events (next 48 hours)
 *       • Last 7 days of recommended outfits (for deduplication)
 *       • Live weather + time-of-day
 *  4. Generates a new session via the recommendation engine
 *
 * This service is called automatically on Dashboard load — the user never
 * has to click "Generate" to see their daily outfit.
 */

const Recommendation = require('../models/Recommendation');
const User           = require('../models/User');
const engine         = require('./recommendationEngine');

/**
 * Returns the start of today in local Nepal time (UTC+5:45).
 * Open-Meteo returns Kathmandu time so we align with that.
 */
function todayStartUTC() {
  const now = new Date();
  // Nepal offset = UTC + 5:45 = 345 minutes
  const nepalOffsetMs = 345 * 60 * 1000;
  const nepalNow  = new Date(now.getTime() + nepalOffsetMs);
  const nepalMidnight = new Date(
    nepalNow.getUTCFullYear(),
    nepalNow.getUTCMonth(),
    nepalNow.getUTCDate(),
    0, 0, 0, 0
  );
  // Convert Nepal midnight back to UTC
  return new Date(nepalMidnight.getTime() - nepalOffsetMs);
}

/**
 * Generates a brand-new daily recommendation, unconditionally — no cache
 * check. Shared by the passive "no daily session yet today" slow path and
 * the explicit regenerateDaily() bypass below.
 */
async function generateNewDaily(userId) {
  const user = await User.findById(userId).lean();
  if (!user) throw new Error('User not found');

  // Fetch context in parallel
  const [upcomingEvent, recentSummaries] = await Promise.all([
    engine.getUpcomingCalendarEvent(userId, 48),
    engine.getRecentOutfitSummaries(userId, 7),
  ]);

  // Determine the best occasion for today
  let occasion = 'daily';
  if (upcomingEvent?.occasion) {
    // If there's a calendar event in the next few hours, use its occasion
    if ((upcomingEvent.hoursAway || 48) <= 12) {
      occasion = upcomingEvent.occasion;
    }
  }

  const session = await engine.generateSession(user, {
    occasion,
    wardrobeOnly:        false,
    requestedBy:         'daily',
    upcomingEvent:       upcomingEvent || null,
    recentOutfitSummaries: recentSummaries,
  });

  return {
    session,
    isNew:            true,
    hasCalendarEvent: !!upcomingEvent,
    calendarEvent:    upcomingEvent ? {
      hasEvent:   true,
      eventType:  upcomingEvent.occasion || 'event',
      eventDate:  upcomingEvent.date,
      eventNotes: upcomingEvent.notes || '',
      hoursAway:  upcomingEvent.hoursAway,
    } : { hasEvent: false },
  };
}

/**
 * Main entry point.
 * Returns { session, isNew, hasCalendarEvent, calendarEvent }
 */
exports.getOrGenerateDaily = async (userId) => {
  const todayStart = todayStartUTC();

  // ── Fast path: today's daily recommendation already exists ─────────────────
  const existing = await Recommendation.populateItems(
    Recommendation.findOne({
      user:                   userId,
      'context.requestedBy':  'daily',
      status:                 'complete',
      createdAt:              { $gte: todayStart },
    }).sort({ createdAt: -1 })
  ).lean();

  if (existing) {
    return {
      session:          existing,
      isNew:            false,
      hasCalendarEvent: existing.calendarEventContext?.hasEvent || false,
      calendarEvent:    existing.calendarEventContext || null,
    };
  }

  // ── Slow path: generate a new daily recommendation ─────────────────────────
  return generateNewDaily(userId);
};

/**
 * Explicitly regenerates today's daily recommendation, bypassing the
 * same-day cache entirely. Because getOrGenerateDaily's fast-path query
 * always takes the newest matching document ({createdAt: -1}), this new
 * session automatically becomes "today's" pick for subsequent passive
 * dashboard loads too — no schema change needed, multiple `requestedBy:
 * 'daily'` sessions can simply coexist for one calendar day.
 */
exports.regenerateDaily = (userId) => generateNewDaily(userId);

/**
 * Retrieves last N daily recommendations for a user.
 * Used by the insights panel to show recommendation history.
 */
exports.getDailyHistory = async (userId, limit = 7) =>
  Recommendation.find(
    { user: userId, 'context.requestedBy': 'daily', status: 'complete' },
    { createdAt: 1, 'recommendations.outfitName': 1, 'recommendations.category': 1,
      'recommendations.confidence': 1, 'context.occasion': 1 }
  )
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
