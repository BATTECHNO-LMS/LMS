'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseDatabaseUrl,
  classifyHostname,
  assertTestDatabaseWriteSafety,
  applyApprovedTestDatabaseUrl,
} = require('./helpers/testDatabaseGuard');

function baseEnv(overrides = {}) {
  return {
    NODE_ENV: 'test',
    ALLOW_TEST_DB_WRITES: 'true',
    DATABASE_URL: 'postgresql://app_user:app_secret@127.0.0.1:5432/lms_app',
    TEST_DATABASE_URL: 'postgresql://test_user:test_secret@127.0.0.1:5432/lms_test',
    ...overrides,
  };
}

describe('testDatabaseGuard', () => {
  test('rejects missing TEST_DATABASE_URL', () => {
    const env = baseEnv();
    delete env.TEST_DATABASE_URL;
    assert.throws(() => assertTestDatabaseWriteSafety(env), /TEST_DATABASE_URL is missing/);
  });

  test('rejects missing ALLOW_TEST_DB_WRITES', () => {
    const env = baseEnv({ ALLOW_TEST_DB_WRITES: undefined });
    delete env.ALLOW_TEST_DB_WRITES;
    assert.throws(() => assertTestDatabaseWriteSafety(env), /ALLOW_TEST_DB_WRITES/);
  });

  test('rejects ALLOW_TEST_DB_WRITES other than explicit true', () => {
    for (const bad of ['1', 'yes', 'TRUE ', 'false', '']) {
      assert.throws(
        () => assertTestDatabaseWriteSafety(baseEnv({ ALLOW_TEST_DB_WRITES: bad })),
        /ALLOW_TEST_DB_WRITES/
      );
    }
  });

  test('rejects when TEST_DATABASE_URL equals DATABASE_URL after normalization', () => {
    const env = baseEnv({
      DATABASE_URL: 'postgresql://u:p@127.0.0.1:5432/lms_test',
      TEST_DATABASE_URL: 'postgresql://other:x@127.0.0.1:5432/lms_test/',
    });
    assert.throws(() => assertTestDatabaseWriteSafety(env), /matches DATABASE_URL/);
  });

  test('allows equal URLs only after apply marker (node --test worker re-entry)', () => {
    const env = baseEnv({
      DATABASE_URL: 'postgresql://u:p@127.0.0.1:5432/lms_test',
      TEST_DATABASE_URL: 'postgresql://u:p@127.0.0.1:5432/lms_test',
      BATTECHNO_TEST_DB_URL_APPLIED: 'true',
    });
    const result = assertTestDatabaseWriteSafety(env);
    assert.equal(result.testHostClass, 'local');
  });

  test('applyApprovedTestDatabaseUrl sets apply marker', () => {
    const env = baseEnv();
    applyApprovedTestDatabaseUrl(env);
    assert.equal(env.BATTECHNO_TEST_DB_URL_APPLIED, 'true');
    assert.equal(env.DATABASE_URL, env.TEST_DATABASE_URL);
  });

  test('rejects remote TEST_DATABASE_URL without ALLOW_REMOTE_TEST_DATABASE', () => {
    const env = baseEnv({
      TEST_DATABASE_URL: 'postgresql://u:p@ep-example.neon.tech:5432/neondb',
    });
    assert.throws(() => assertTestDatabaseWriteSafety(env), /classified as remote/);
  });

  test('accepts local isolated TEST_DATABASE_URL with explicit write permission', () => {
    const result = assertTestDatabaseWriteSafety(baseEnv());
    assert.equal(result.testHostClass, 'local');
    assert.equal(result.appHostClass, 'local');
  });

  test('accepts remote only with ALLOW_REMOTE_TEST_DATABASE=true and isolation', () => {
    const env = baseEnv({
      DATABASE_URL: 'postgresql://u:p@ep-app.neon.tech:5432/appdb',
      TEST_DATABASE_URL: 'postgresql://u:p@ep-test.neon.tech:5432/testdb',
      ALLOW_REMOTE_TEST_DATABASE: 'true',
    });
    const result = assertTestDatabaseWriteSafety(env);
    assert.equal(result.testHostClass, 'remote');
  });

  test('error messages do not expose credentials', () => {
    const secretUser = 'super_secret_user_xyz';
    const secretPass = 'super_secret_pass_xyz';
    const env = baseEnv({
      DATABASE_URL: `postgresql://${secretUser}:${secretPass}@127.0.0.1:5432/lms_app`,
      TEST_DATABASE_URL: `postgresql://${secretUser}:${secretPass}@127.0.0.1:5432/lms_app`,
    });
    try {
      assertTestDatabaseWriteSafety(env);
      assert.fail('expected throw');
    } catch (err) {
      const msg = String(err.message);
      assert.equal(msg.includes(secretUser), false);
      assert.equal(msg.includes(secretPass), false);
      assert.equal(msg.includes('postgresql://'), false);
    }
  });

  test('invalid URLs fail safely', () => {
    assert.throws(
      () => assertTestDatabaseWriteSafety(baseEnv({ TEST_DATABASE_URL: 'not-a-url' })),
      /not a usable database URL/
    );
    assert.throws(
      () => assertTestDatabaseWriteSafety(baseEnv({ TEST_DATABASE_URL: 'mysql://127.0.0.1/db' })),
      /unsupported_protocol|not a usable/
    );
  });

  test('rejects non-test NODE_ENV', () => {
    assert.throws(
      () => assertTestDatabaseWriteSafety(baseEnv({ NODE_ENV: 'development' })),
      /NODE_ENV must be exactly "test"/
    );
  });

  test('parseDatabaseUrl and classifyHostname do not open sockets', () => {
    const parsed = parseDatabaseUrl('postgresql://u:p@127.0.0.1:5432/db');
    assert.equal(parsed.ok, true);
    assert.equal(classifyHostname(parsed.hostname), 'local');
    assert.equal(classifyHostname('ep-x.neon.tech'), 'remote');
  });

  test('assertTestDatabaseWriteSafety does not mutate env', () => {
    const env = baseEnv();
    const before = { ...env };
    assertTestDatabaseWriteSafety(env);
    assert.deepEqual(env, before);
  });

  test('applyApprovedTestDatabaseUrl sets DATABASE_URL to TEST_DATABASE_URL after checks', () => {
    const env = baseEnv();
    const testUrl = env.TEST_DATABASE_URL;
    applyApprovedTestDatabaseUrl(env);
    assert.equal(env.DATABASE_URL, testUrl);
  });

  test('guard module source does not import Prisma or config/db', () => {
    const fs = require('fs');
    const src = fs.readFileSync(require.resolve('./helpers/testDatabaseGuard'), 'utf8');
    assert.equal(/@prisma\/client|PrismaClient|config\/db/.test(src), false);
  });
});
