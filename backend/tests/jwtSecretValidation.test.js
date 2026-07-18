'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateJwtSecret,
  assertJwtSecret,
} = require('../src/config/jwtSecretValidation');

describe('jwtSecretValidation', () => {
  test('rejects missing secret', () => {
    assert.equal(validateJwtSecret(undefined).ok, false);
    assert.equal(validateJwtSecret(null).ok, false);
  });

  test('rejects empty or whitespace-only secret', () => {
    assert.equal(validateJwtSecret('').ok, false);
    assert.equal(validateJwtSecret('   ').ok, false);
    assert.match(validateJwtSecret('').reason, /empty/i);
  });

  test('rejects obvious placeholders', () => {
    for (const bad of [
      'changeme',
      'your-local-dev-secret-at-least-32-chars',
      'jwt_secret',
      'secret',
      'battechno-dev-only-change-me',
      'replace-me',
    ]) {
      const r = validateJwtSecret(bad, { minLength: 8 });
      assert.equal(r.ok, false, `expected reject: ${bad}`);
      assert.match(r.reason, /placeholder|at least/i);
    }
  });

  test('rejects secrets shorter than minLength', () => {
    const r = validateJwtSecret('a'.repeat(31), { minLength: 32 });
    assert.equal(r.ok, false);
    assert.match(r.reason, /at least 32/);
  });

  test('accepts a strong non-placeholder secret', () => {
    const secret = 'x'.repeat(64);
    const r = validateJwtSecret(secret, { minLength: 32 });
    assert.equal(r.ok, true);
    assert.doesNotThrow(() => assertJwtSecret(secret, { minLength: 32 }));
  });

  test('assertJwtSecret throws with reason', () => {
    assert.throws(() => assertJwtSecret(''), /empty/i);
  });
});
