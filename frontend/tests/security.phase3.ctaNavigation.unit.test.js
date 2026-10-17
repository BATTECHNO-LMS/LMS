import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sanitizeReturnTo } from '../src/features/auth/session/sessionPolicy.js';
import { isSafeBackPath } from '../src/utils/authRouting.js';
import { getNotificationLink } from '../src/utils/notificationDeepLink.js';

describe('Phase 3 — open redirect guards (frontend)', () => {
  it('sanitizeReturnTo rejects protocol-relative URLs', () => {
    assert.equal(sanitizeReturnTo('//evil.example/phish'), null);
    assert.equal(sanitizeReturnTo('/\\evil'), null);
    assert.equal(sanitizeReturnTo('/admin/users'), '/admin/users');
  });

  it('isSafeBackPath rejects // and schemes', () => {
    assert.equal(isSafeBackPath('//evil.example'), false);
    assert.equal(isSafeBackPath('/javascript:alert(1)'), false);
    assert.equal(isSafeBackPath('/admin/dashboard'), true);
  });

  it('getNotificationLink ignores protocol-relative action_url', () => {
    const link = getNotificationLink(
      { action_url: '//evil.example/x', type: 'system', title: 't' },
      { roles: ['student'] }
    );
    assert.equal(link, null);
  });

  it('getNotificationLink accepts safe relative action_url', () => {
    const link = getNotificationLink(
      { action_url: '/student/dashboard', type: 'system', title: 't' },
      { roles: ['student'] }
    );
    assert.equal(link, '/student/dashboard');
  });
});
