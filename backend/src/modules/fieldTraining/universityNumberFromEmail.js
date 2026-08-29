'use strict';

/**
 * Derive the university number from a university email local-part.
 * Never falls back to a user UUID or database id — callers must pass only the email.
 *
 * @param {unknown} email
 * @returns {string} local-part before the first `@`, or '' if missing/invalid
 */
function extractUniversityNumberFromEmail(email) {
  if (email == null) return '';
  const text = String(email).trim();
  const at = text.indexOf('@');
  if (at <= 0) return '';
  return text.slice(0, at).trim();
}

module.exports = {
  extractUniversityNumberFromEmail,
};
