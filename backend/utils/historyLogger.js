const UserHistory = require('../models/UserHistory');

/**
 * Log a user activity to the history collection.
 * Silent-fails so it never breaks the main operation.
 */
async function logActivity(userId, { action, category, title, description = '', metadata = {}, refId = null }) {
  try {
    await UserHistory.create({ user: userId, action, category, title, description, metadata, refId: refId || null });
  } catch (err) {
    // Non-critical — do not propagate
    console.warn('[historyLogger] Failed to log activity:', err.message);
  }
}

module.exports = logActivity;
