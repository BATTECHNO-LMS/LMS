/**
 * Integration preload / first-line require: load dotenv, then fail-closed
 * before any Prisma client is constructed against the app DATABASE_URL.
 *
 * Idempotent: safe to require from npm --require and again from test files.
 */
'use strict';

const path = require('path');

if (!globalThis.__battechnoIntegrationDbGuardApplied) {
  require('dotenv').config({
    path: path.join(__dirname, '..', '..', '.env'),
  });

  const { applyApprovedTestDatabaseUrl } = require('./testDatabaseGuard');
  applyApprovedTestDatabaseUrl(process.env);
  globalThis.__battechnoIntegrationDbGuardApplied = true;
}

module.exports = { integrationDbReady: true };
