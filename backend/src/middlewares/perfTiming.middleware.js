'use strict';

const { env } = require('../config/env');
const { runWithQueryTiming, getQueryTimingSummary } = require('../config/queryTiming');

/**
 * Optional request timing (PERF_LOGGING=true). Logs method + path + status + ms.
 * Does not log query strings, headers, cookies, bodies, or SQL parameters.
 */
function createPerfTimingMiddleware() {
  if (!env.PERF_LOGGING) {
    return (_req, _res, next) => next();
  }

  return (req, res, next) => {
    runWithQueryTiming(() => {
      const start = process.hrtime.bigint();
      res.on('finish', () => {
        const ms = Number(process.hrtime.bigint() - start) / 1e6;
        const pathOnly = String(req.originalUrl || req.url || '').split('?')[0];
        const summary = getQueryTimingSummary();
        if (ms < 400 && summary.totalMs < 400) return;
        // eslint-disable-next-line no-console
        console.info(
          `[perf] ${req.method} ${pathOnly} ${res.statusCode} ${Math.round(ms)}ms queries=${summary.count} db=${Math.round(summary.totalMs)}ms`
        );
        const slow = [...summary.queries].sort((a, b) => b.durationMs - a.durationMs).slice(0, 8);
        for (const q of slow) {
          if (q.durationMs < 40) continue;
          // eslint-disable-next-line no-console
          console.info(`[perf:query] ${Math.round(q.durationMs)}ms ${q.sql}`);
        }
      });
      next();
    });
  };
}

module.exports = { createPerfTimingMiddleware };