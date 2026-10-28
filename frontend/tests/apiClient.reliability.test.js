import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('apiClient reliability', () => {
  test('retries safe GET on transient network/502-504 only once', () => {
    const src = read('src/services/apiClient.js');
    assert.match(src, /SAFE_GET_RETRY_STATUSES/);
    assert.match(src, /__reliabilityRetried/);
    assert.match(src, /isSafeGetMethod/);
    assert.ok(src.includes('forgot-password'));
    assert.ok(src.includes('502, 503, 504'));
  });

  test('does not blindly retry mutations', () => {
    const src = read('src/services/apiClient.js');
    assert.match(src, /Never auto-retry mutations|isSafeGetMethod/);
    assert.doesNotMatch(src, /method\)\s*===\s*['"]post['"].*__reliabilityRetried/i);
  });

  test('network vs server error messages are differentiated', () => {
    const src = read('src/services/apiHelpers.js');
    assert.match(src, /ECONNABORTED/);
    assert.match(src, /status >= 500/);
    assert.match(src, /requestId/);
  });
});
