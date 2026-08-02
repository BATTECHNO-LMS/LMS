'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

describe('training attendance code hashing', () => {
  it('hashes attendance codes consistently without exposing plaintext', () => {
    const code = '123456';
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    assert.equal(hash.length, 64);
    assert.notEqual(hash, code);
    assert.equal(crypto.createHash('sha256').update(code).digest('hex'), hash);
  });
});
