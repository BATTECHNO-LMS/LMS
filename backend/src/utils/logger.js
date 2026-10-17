const { env } = require('../config/env');
const { getRequestContext } = require('../shared/requestContext');
const { sanitizeForLog, redactString } = require('../shared/security/redaction');

/**
 * Structured application logger. Audit trail writes stay in audit.service / DB — not here.
 * The current request id (if any) is attached automatically. Metadata is redacted
 * (passwords, tokens, cookies, OTPs, JWT-looking strings) and size-bounded.
 * @param {'info'|'warn'|'error'} level
 * @param {string} message
 * @param {Record<string, unknown>} [meta]
 */
function log(level, message, meta = {}) {
  const ctx = getRequestContext();
  const safeMeta = meta && typeof meta === 'object' ? sanitizeForLog(meta) : {};
  const entry = {
    ts: new Date().toISOString(),
    level,
    service: 'battechno-lms-api',
    message: redactString(String(message ?? '')).slice(0, 2000),
    ...(ctx?.requestId && safeMeta.requestId === undefined ? { requestId: ctx.requestId } : {}),
    ...safeMeta,
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
    const { ts, level: _l, service: _s, message: safeMessage, ...rest } = entry;
    // eslint-disable-next-line no-console
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
      `[${ts}] ${level.toUpperCase()} ${safeMessage}`,
      Object.keys(rest).length ? rest : ''
    );
  }
}

const logger = Object.freeze({
  info: (message, meta) => log('info', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  error: (message, meta) => log('error', message, meta),
});

module.exports = { log, logger };
