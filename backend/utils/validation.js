'use strict';

exports.STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

exports.PASSWORD_ERROR_MSG =
  'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.';

/**
 * Escapes regex metacharacters so user-supplied search text can be safely
 * embedded in a MongoDB $regex query. Without this, raw user input is
 * interpreted as a regex pattern — both a correctness bug (e.g. "." matches
 * any character instead of a literal dot) and a ReDoS vector (a pathological
 * pattern can cause catastrophic backtracking on the database).
 */
exports.escapeRegex = (str = '') => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Returns `value` only if it appears in `validValues`, else the empty string. */
exports.sanitizeEnum = (value, validValues) => (validValues.includes(value) ? value : '');

/** Filters `values` down to only the entries present in `validValues`, de-duplicated. */
exports.sanitizeEnumArray = (values, validValues) => {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter(v => validValues.includes(v)))];
};
