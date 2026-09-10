'use strict';

/**
 * Read-only auth-context query-count probe.
 * Prints counts only (no emails, tokens, or names).
 *
 * Usage (from backend/):
 *   node scripts/p0-2-auth-query-count.js
 *
 * Requires DATABASE_URL. Does not write.
 */

const { prisma } = require('../src/config/db');
const {
  loadCurrentAuthContext,
  loadCurrentAuthContextFromDb,
} = require('../src/modules/auth/currentAuthContext');
const { authContextCache } = require('../src/modules/auth/authContextCache');

const COUNTED_MODELS = [
  'users',
  'user_roles',
  'reviewer_university_assignments',
  'roles',
  'role_permissions',
  'permissions',
  'universities',
  'organizations',
];
const COUNTED_OPS = ['findUnique', 'findFirst', 'findMany', 'count'];

let observed = [];

for (const model of COUNTED_MODELS) {
  const delegate = prisma[model];
  if (!delegate) continue;
  for (const op of COUNTED_OPS) {
    const orig = delegate[op];
    if (typeof orig !== 'function') continue;
    delegate[op] = function patched(...args) {
      observed.push(`${model}.${op}`);
      return orig.apply(this, args);
    };
  }
}

async function timedLoad(label, fn) {
  observed = [];
  const started = Date.now();
  try {
    await fn();
    return {
      label,
      ok: true,
      ms: Date.now() - started,
      queryCount: observed.length,
      operations: observed.slice(),
    };
  } catch (err) {
    return {
      label,
      ok: false,
      error: err.code || err.message,
      ms: Date.now() - started,
      queryCount: observed.length,
      operations: observed.slice(),
    };
  }
}

async function main() {
  const user = await prisma.users.findFirst({
    where: { status: 'active' },
    select: { id: true },
    orderBy: { created_at: 'asc' },
  });
  if (!user) {
    console.log(JSON.stringify({ status: 'NO_ACTIVE_USER' }));
    return;
  }

  const portalType = 'UNIVERSITY';
  authContextCache.clear();

  const coldUncached = await timedLoad('cold_from_db', () =>
    loadCurrentAuthContextFromDb(user.id, { portalType })
  );

  authContextCache.clear();
  const coldCachedPath = await timedLoad('cold_via_cache', () =>
    loadCurrentAuthContext(user.id, { portalType })
  );
  const warm1 = await timedLoad('warm_via_cache_1', () =>
    loadCurrentAuthContext(user.id, { portalType })
  );
  const warm2 = await timedLoad('warm_via_cache_2', () =>
    loadCurrentAuthContext(user.id, { portalType })
  );

  console.log(
    JSON.stringify(
      {
        status: 'OK',
        cacheTtlMs: authContextCache.ttlMs,
        cacheMaxEntries: authContextCache.maxEntries,
        measurements: [coldUncached, coldCachedPath, warm1, warm2],
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(JSON.stringify({ status: 'ERROR', code: err.code || null, message: err.message }));
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
  });
