import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('ForgotPasswordPage UX', () => {
  test('maps 502/503/504 to safe Arabic outage copy (not Bad Gateway)', () => {
    const src = read('src/pages/auth/ForgotPasswordPage.jsx');
    assert.match(src, /status === 502/);
    assert.match(src, /تعذر إكمال الطلب حاليًا/);
    assert.doesNotMatch(src, /Bad Gateway/);
  });

  test('does not auto-retry forgot-password POST', () => {
    const src = read('src/pages/auth/ForgotPasswordPage.jsx');
    assert.doesNotMatch(src, /retry|setInterval.*forgotPassword/i);
    assert.match(src, /forgotPassword\(normalizedEmail\)/);
  });

  test('email input uses dir=ltr', () => {
    const src = read('src/pages/auth/ForgotPasswordPage.jsx');
    assert.match(src, /id="forgot-email"[\s\S]*?dir="ltr"/);
  });
});
