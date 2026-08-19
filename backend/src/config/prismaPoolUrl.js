'use strict';

/**
 * Merge Prisma/Neon pool params onto DATABASE_URL without rewriting credentials.
 * Does not log the URL.
 */

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function applyPrismaPoolParams(rawUrl, options = {}) {
  const url = String(rawUrl || '').trim();
  if (!url) return url;

  const hashIdx = url.indexOf('#');
  const withoutHash = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
  const qIdx = withoutHash.indexOf('?');
  const base = qIdx >= 0 ? withoutHash.slice(0, qIdx) : withoutHash;
  const query = qIdx >= 0 ? withoutHash.slice(qIdx + 1) : '';
  const params = new URLSearchParams(query);

  const hostMatch = base.match(/@([^/?]+)/);
  const host = hostMatch ? hostMatch[1] : '';
  const isPooler = /-pooler\./i.test(host);

  const connectionLimit = clampInt(options.connectionLimit, 25, 5, 80);
  const poolTimeout = clampInt(options.poolTimeout, 20, 5, 60);
  const connectTimeout = clampInt(options.connectTimeout, 15, 5, 60);

  if (isPooler && !params.has('pgbouncer')) {
    params.set('pgbouncer', 'true');
  }
  if (!params.has('connection_limit')) {
    params.set('connection_limit', String(connectionLimit));
  }
  if (!params.has('pool_timeout')) {
    params.set('pool_timeout', String(poolTimeout));
  }
  if (!params.has('connect_timeout')) {
    params.set('connect_timeout', String(connectTimeout));
  }

  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function describePrismaPoolUrl(rawUrl) {
  const applied = applyPrismaPoolParams(rawUrl);
  const qIdx = applied.indexOf('?');
  const query = qIdx >= 0 ? applied.slice(qIdx + 1) : '';
  const params = new URLSearchParams(query);
  const hostMatch = String(rawUrl || '').match(/@([^/?]+)/);
  const host = hostMatch ? hostMatch[1] : '';
  return {
    isPooler: /-pooler\./i.test(host),
    connectionLimit: params.get('connection_limit'),
    poolTimeout: params.get('pool_timeout'),
    pgbouncer: params.get('pgbouncer'),
  };
}

module.exports = { applyPrismaPoolParams, describePrismaPoolUrl };
