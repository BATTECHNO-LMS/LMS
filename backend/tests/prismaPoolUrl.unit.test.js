'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { applyPrismaPoolParams, describePrismaPoolUrl } = require('../src/config/prismaPoolUrl');

describe('applyPrismaPoolParams', () => {
  it('adds pool params without changing userinfo', () => {
    const src = 'postgresql://app_user:s3cret@ep-example.neon.tech:5432/neondb?sslmode=require';
    const out = applyPrismaPoolParams(src, { connectionLimit: 25, poolTimeout: 20, connectTimeout: 15 });
    assert.match(out, /^postgresql:\/\/app_user:s3cret@ep-example\.neon\.tech:5432\/neondb\?/);
    assert.match(out, /sslmode=require/);
    assert.match(out, /connection_limit=25/);
    assert.match(out, /pool_timeout=20/);
    assert.match(out, /connect_timeout=15/);
    assert.doesNotMatch(out, /pgbouncer=/);
  });

  it('enables pgbouncer on Neon pooled hosts and preserves existing params', () => {
    const src = 'postgresql://u:p@ep-foo-pooler.us-east-1.aws.neon.tech/db?sslmode=require';
    const out = applyPrismaPoolParams(src);
    const info = describePrismaPoolUrl(src);
    assert.equal(info.isPooler, true);
    assert.match(out, /pgbouncer=true/);
    assert.match(out, /connection_limit=25/);
    assert.match(out, /sslmode=require/);
  });

  it('does not override an explicit connection_limit', () => {
    const src = 'postgresql://u:p@localhost:5432/lms?connection_limit=7';
    const out = applyPrismaPoolParams(src, { connectionLimit: 25 });
    assert.match(out, /connection_limit=7/);
    assert.doesNotMatch(out, /connection_limit=25/);
  });

  it('returns empty input unchanged', () => {
    assert.equal(applyPrismaPoolParams(''), '');
    assert.equal(applyPrismaPoolParams(null), '');
  });
});
