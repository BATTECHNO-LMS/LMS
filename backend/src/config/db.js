const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis;

/** One client per Node process; avoids extra pools when tooling reloads modules in dev. */
function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

const prisma = globalForPrisma.__battechnoPrisma ?? createPrismaClient();
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__battechnoPrisma = prisma;
}

function isTransientDbError(err) {
  if (!err || typeof err !== 'object') return false;
  const msg = String(err.message || '');
  const code = err.code;
  return (
    code === 'P1017' ||
    /Server has closed the connection/i.test(msg) ||
    /Closed? the connection/i.test(msg) ||
    /ECONNRESET|ETIMEDOUT|EPIPE/i.test(msg) ||
    /connection.*(terminated|closed|reset)/i.test(msg) ||
    /Client has encountered a connection error/i.test(msg)
  );
}

/**
 * Retry a few times on idle disconnect / pool hiccups (common with serverless Postgres).
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ attempts?: number, baseDelayMs?: number }} [opts]
 * @returns {Promise<T>}
 */
async function withDbRetry(fn, { attempts = 3, baseDelayMs = 100 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!isTransientDbError(e) || i === attempts - 1) throw e;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, baseDelayMs * (i + 1)));
    }
  }
  throw lastErr;
}

module.exports = { prisma, withDbRetry, isTransientDbError };
