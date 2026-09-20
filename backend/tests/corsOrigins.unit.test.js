'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getBrowserCorsOrigins, BUILTIN_BROWSER_CORS_ORIGINS } = require('../src/config/corsOrigins');

describe('getBrowserCorsOrigins', () => {
  it('includes the canonical eprojecto origins used by the production frontend', () => {
    const origins = getBrowserCorsOrigins();
    assert.equal(origins.includes('https://eprojecto.com'), true);
    assert.equal(origins.includes('https://www.eprojecto.com'), true);
  });

  it('does not contain duplicates', () => {
    const origins = getBrowserCorsOrigins();
    assert.equal(origins.length, new Set(origins).size);
  });

  it('keeps the built-in allowlist as the baseline', () => {
    const origins = getBrowserCorsOrigins();
    for (const origin of BUILTIN_BROWSER_CORS_ORIGINS) {
      assert.equal(origins.includes(origin), true);
    }
  });
});
