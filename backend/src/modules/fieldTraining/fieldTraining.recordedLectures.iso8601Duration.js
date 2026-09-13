'use strict';

/**
 * Parse YouTube ISO-8601 durations (PT#H#M#S) into whole seconds.
 * Does not use string replacement of H/M/S tokens.
 */
function parseIso8601Duration(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(raw);
  if (!match) return null;
  const days = Number(match[1] || 0);
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  const seconds = Number(match[4] || 0);
  if (![days, hours, minutes, seconds].every((n) => Number.isFinite(n))) return null;
  const total = days * 86400 + hours * 3600 + minutes * 60 + seconds;
  return Math.max(0, Math.floor(total));
}

module.exports = { parseIso8601Duration };
