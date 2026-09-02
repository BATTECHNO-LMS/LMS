'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { extractBearerToken } = require('../src/middlewares/auth.middleware');

describe('extractBearerToken', () => {
  it('reads Authorization Bearer header', () => {
    const token = extractBearerToken({
      method: 'GET',
      headers: { authorization: 'Bearer abc.def.ghi' },
      query: {},
    });
    assert.equal(token, 'abc.def.ghi');
  });

  it('reads access_token query on GET for /uploads browser opens', () => {
    const token = extractBearerToken({
      method: 'GET',
      headers: {},
      query: { access_token: 'query-token-value' },
    });
    assert.equal(token, 'query-token-value');
  });

  it('ignores query token on non-GET methods', () => {
    const token = extractBearerToken({
      method: 'POST',
      headers: {},
      query: { access_token: 'should-ignore' },
    });
    assert.equal(token, null);
  });
});
