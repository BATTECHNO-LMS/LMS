import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('ACCOUNT-DELETION public web pages', () => {
  test('router registers /privacy-policy and /account-deletion outside ProtectedRoute', () => {
    const router = fs.readFileSync(
      path.join(root, 'src/app/router/index.jsx'),
      'utf8'
    );
    const privacyIdx = router.indexOf('path="/privacy-policy"');
    const deletionIdx = router.indexOf('path="/account-deletion"');
    const protectedIdx = router.indexOf('<ProtectedRoute');
    assert.ok(privacyIdx > 0);
    assert.ok(deletionIdx > 0);
    assert.ok(privacyIdx < protectedIdx);
    assert.ok(deletionIdx < protectedIdx);
  });

  test('legal AR/EN copy and cross-links exist', () => {
    const en = JSON.parse(
      fs.readFileSync(path.join(root, 'src/i18n/locales/en/legal.json'), 'utf8')
    );
    const ar = JSON.parse(
      fs.readFileSync(path.join(root, 'src/i18n/locales/ar/legal.json'), 'utf8')
    );
    assert.ok(en.privacy.title);
    assert.ok(ar.privacy.title);
    assert.ok(en.deletion.stepsTitle);
    assert.ok(ar.deletion.stepsTitle);
    assert.match(en.deletion.inactiveBody, /privacy@battechno\.com/);
    assert.match(en.privacy.accountDeletionLink, /deletion/i);
    assert.match(en.deletion.intro, /Request Account Deletion|settings/i);
  });

  test('footer links privacy and account deletion', () => {
    const footer = fs.readFileSync(
      path.join(root, 'src/components/landing/HomeFooter.jsx'),
      'utf8'
    );
    assert.match(footer, /to="\/privacy-policy"/);
    assert.match(footer, /to="\/account-deletion"/);
    assert.match(footer, /privacy@battechno\.com/);
  });

  test('account deletion page includes ownership verification and request form', () => {
    const page = fs.readFileSync(
      path.join(root, 'src/pages/public/LegalPublicPages.jsx'),
      'utf8'
    );
    assert.match(page, /DeletionRequestForm/);
    assert.match(page, /privacy@battechno\.com/);
    assert.match(page, /mailto:/);
  });
});
