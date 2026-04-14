const { env } = require('../config/env');

/**
 * Structured application logger. Audit trail writes stay in audit.service / DB — not here.
 * @param {'info'|'warn'|'error'} level
 * @param {string} message
 * @param {Record<string, unknown>} [meta]
 */
function log(level, message, meta = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    service: 'battechno-lms-api',
    message,
    ...meta,
  };
  if (env.NODE_ENV === 'production') {
    const line = JSON.stringify(entry);
    if (level === 'error') {
      // eslint-disable-next-line no-console
      console.error(line);
    } else if (level === 'warn') {
      // eslint-disable-next-line no-console
      console.warn(line);
    } else {
      // eslint-disable-next-line no-console
      console.log(line);
    }
  } else {
    // eslint-disable-next-line no-console
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
      `[${entry.ts}] ${level.toUpperCase()} ${message}`,
      Object.keys(meta).length ? meta : ''
    );
  }
}

module.exports = { log };
