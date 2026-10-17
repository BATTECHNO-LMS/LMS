'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { extractBearerToken, isQueryTokenPath } = require('../src/middlewares/auth.middleware');

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
      originalUrl: '/uploads/materials/x.pdf?access_token=query-token-value',
      headers: {},
      query: { access_token: 'query-token-value' },
    });
    assert.equal(token, 'query-token-value');
  });

  it('reads access_token query for the command-center SSE stream', () => {
    const token = extractBearerToken({
      method: 'GET',
      originalUrl: '/api/v1/analytics/command-center/live?access_token=sse-token',
      headers: {},
      query: { access_token: 'sse-token' },
    });
    assert.equal(token, 'sse-token');
  });

  it('ignores query token on other GET API paths', () => {
    const token = extractBearerToken({
      method: 'GET',
      originalUrl: '/api/v1/users?access_token=should-ignore',
      headers: {},
      query: { access_token: 'should-ignore' },
    });
    assert.equal(token, null);
  });

  it('ignores query token on non-GET methods', () => {
    const token = extractBearerToken({
      method: 'POST',
      originalUrl: '/uploads/x.pdf',
      headers: {},
      query: { access_token: 'should-ignore' },
    });
    assert.equal(token, null);
  });

  it('does not treat lookalike paths as query-token paths', () => {
    assert.equal(isQueryTokenPath({ originalUrl: '/api/v1/uploads/x' }), false);
    assert.equal(isQueryTokenPath({ originalUrl: '/api/v1/analytics/command-center/live-export' }), false);
    assert.equal(isQueryTokenPath({ originalUrl: '/uploads/a/b.png?x=1' }), true);
  });
});
