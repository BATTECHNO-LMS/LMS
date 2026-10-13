'use strict';

const REPORT_READ_DEDUPE_TTL_MS = 15 * 60 * 1000;
const REPORT_READ_DEDUPE_MAX = 5_000;
const recentReads = new Map();

/**
 * True when this user + report type + entity was already recorded within the TTL.
 * Otherwise marks it as recorded now and returns false. In-process only.
 */
function isDuplicateReportRead(userId, type, entityId) {
  if (!userId) return false;
  const key = `${userId}:${type || ''}:${entityId || ''}`;
  const now = Date.now();
  const seenAt = recentReads.get(key);
  if (seenAt && now - seenAt < REPORT_READ_DEDUPE_TTL_MS) return true;
  recentReads.delete(key);
  if (recentReads.size >= REPORT_READ_DEDUPE_MAX) recentReads.delete(recentReads.keys().next().value);
  recentReads.set(key, now);
  return false;
}

function clearReportReadDedupeForTests() {
  recentReads.clear();
}

module.exports = {
  REPORT_READ_DEDUPE_TTL_MS,
  isDuplicateReportRead,
  clearReportReadDedupeForTests,
};
