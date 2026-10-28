'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyProviderError,
  RESEND_TIMEOUT_MS,
} = require('../src/shared/services/email.service');
const { applyPrismaPoolParams, summarizeDatabaseHost } = require('../src/config/prismaPoolUrl');
const { ADMIN_MAX_PAGE_SIZE, MAX_PAGE_SIZE } = require('../src/utils/pagination');

describe('email provider error classification', () => {
  it('classifies domain verification failures', () => {
    assert.equal(
      classifyProviderError(400, 'The associated domain with your API key is not verified'),
      'sender_domain_unverified'
    );
  });

  it('classifies auth and rate-limit', () => {
    assert.equal(classifyProviderError(401, 'unauthorized'), 'provider_auth_or_permission');
    assert.equal(classifyProviderError(429, 'rate'), 'provider_rate_limited');
  });

  it('exposes a bounded outbound timeout', () => {
    assert.ok(RESEND_TIMEOUT_MS >= 3000 && RESEND_TIMEOUT_MS <= 20000);
  });
});

describe('prisma pool defaults for Neon pooler', () => {
  it('applies modest connection_limit and pgbouncer on pooler hosts', () => {
    const url = applyPrismaPoolParams(
      'postgresql://u:p@ep-x-pooler.c-3.us-east-2.aws.neon.tech/db?sslmode=require'
    );
    assert.match(url, /pgbouncer=true/);
    assert.match(url, /connection_limit=10/);
    const summary = summarizeDatabaseHost(
      'postgresql://u:p@ep-x-pooler.c-3.us-east-2.aws.neon.tech/db'
    );
    assert.equal(summary.provider, 'neon');
    assert.equal(summary.region_hint, 'us-east-2');
    assert.equal(summary.pooled_connection, true);
  });
});

describe('pagination hard caps', () => {
  it('keeps list page sizes bounded', () => {
    assert.equal(MAX_PAGE_SIZE, 100);
    assert.ok(ADMIN_MAX_PAGE_SIZE <= 300);
  });
});
