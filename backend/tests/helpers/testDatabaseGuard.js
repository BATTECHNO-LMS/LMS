/**
 * Fail-closed safety checks for database-writing integration tests.
 * Does not connect to any database. Does not log secrets.
 */

'use strict';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** Accept only the exact string `true` (fail-closed; no case/whitespace variants). */
function isExplicitTrue(value) {
  return value === 'true';
}

/**
 * Normalize a PostgreSQL URL for equality comparison (no credentials in output).
 * @param {string} raw
 * @returns {{ ok: true, comparable: string, hostname: string, protocol: string } | { ok: false, reason: string }}
 */
function parseDatabaseUrl(raw) {
  if (raw == null || String(raw).trim() === '') {
    return { ok: false, reason: 'empty' };
  }
  let parsed;
  try {
    parsed = new URL(String(raw).trim());
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }
  const protocol = (parsed.protocol || '').toLowerCase();
  if (protocol !== 'postgres:' && protocol !== 'postgresql:') {
    return { ok: false, reason: 'unsupported_protocol' };
  }
  const hostname = (parsed.hostname || '').toLowerCase();
  if (!hostname) {
    return { ok: false, reason: 'missing_hostname' };
  }
  const port = parsed.port || '';
  const pathname = parsed.pathname || '';
  // Comparable form intentionally omits username/password/search params.
  const comparable = `${protocol}//${hostname}${port ? `:${port}` : ''}${pathname}`.replace(/\/$/, '').toLowerCase();
  return { ok: true, comparable, hostname, protocol };
}

/**
 * @param {string} hostname
 * @returns {'local' | 'remote'}
 */
function classifyHostname(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (LOCAL_HOSTS.has(host)) return 'local';
  return 'remote';
}

/**
 * Validate that integration DB writes are explicitly allowed and isolated.
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @returns {{ testHostClass: 'local' | 'remote', appHostClass: 'local' | 'remote' | 'unset' }}
 */
function assertTestDatabaseWriteSafety(env = process.env) {
  const nodeEnv = String(env.NODE_ENV || '').trim();
  if (nodeEnv !== 'test') {
    throw new Error(
      'Test DB writes blocked: NODE_ENV must be exactly "test" (got missing or non-test).'
    );
  }

  if (!Object.prototype.hasOwnProperty.call(env, 'TEST_DATABASE_URL') || env.TEST_DATABASE_URL == null) {
    throw new Error('Test DB writes blocked: TEST_DATABASE_URL is missing.');
  }
  if (String(env.TEST_DATABASE_URL).trim() === '') {
    throw new Error('Test DB writes blocked: TEST_DATABASE_URL is empty.');
  }

  if (!isExplicitTrue(env.ALLOW_TEST_DB_WRITES)) {
    throw new Error(
      'Test DB writes blocked: ALLOW_TEST_DB_WRITES must be exactly "true".'
    );
  }

  const testParsed = parseDatabaseUrl(env.TEST_DATABASE_URL);
  if (!testParsed.ok) {
    throw new Error(
      `Test DB writes blocked: TEST_DATABASE_URL is not a usable database URL (${testParsed.reason}).`
    );
  }

  const appRaw = env.DATABASE_URL;
  let appHostClass = 'unset';
  if (appRaw != null && String(appRaw).trim() !== '') {
    const appParsed = parseDatabaseUrl(appRaw);
    if (!appParsed.ok) {
      throw new Error(
        `Test DB writes blocked: DATABASE_URL is not a usable database URL (${appParsed.reason}).`
      );
    }
    appHostClass = classifyHostname(appParsed.hostname);
    const alreadyOnTestDb = appParsed.comparable === testParsed.comparable;
    const applyMarker = env.BATTECHNO_TEST_DB_URL_APPLIED === 'true';
    // Require isolation before the first apply. After apply, node --test workers may
    // inherit DATABASE_URL already rewritten to TEST_DATABASE_URL — allow only with marker.
    if (alreadyOnTestDb && !applyMarker) {
      throw new Error(
        'Test DB writes blocked: TEST_DATABASE_URL matches DATABASE_URL after normalization (must be isolated).'
      );
    }
  }

  const testHostClass = classifyHostname(testParsed.hostname);
  if (testHostClass === 'remote' && !isExplicitTrue(env.ALLOW_REMOTE_TEST_DATABASE)) {
    throw new Error(
      'Test DB writes blocked: TEST_DATABASE_URL host is classified as remote; set ALLOW_REMOTE_TEST_DATABASE=true only for an approved isolated remote test database.'
    );
  }

  return { testHostClass, appHostClass };
}

/**
 * After safety checks, point Prisma's DATABASE_URL at the approved TEST_DATABASE_URL.
 * Mutates only `env.DATABASE_URL` (typically process.env in the integration preload).
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 */
function applyApprovedTestDatabaseUrl(env = process.env) {
  assertTestDatabaseWriteSafety(env);
  env.DATABASE_URL = env.TEST_DATABASE_URL;
  env.BATTECHNO_TEST_DB_URL_APPLIED = 'true';
  return {
    applied: true,
    testHostClass: classifyHostname(parseDatabaseUrl(env.TEST_DATABASE_URL).hostname),
  };
}

module.exports = {
  LOCAL_HOSTS,
  isExplicitTrue,
  parseDatabaseUrl,
  classifyHostname,
  assertTestDatabaseWriteSafety,
  applyApprovedTestDatabaseUrl,
};
