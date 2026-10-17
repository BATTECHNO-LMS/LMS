import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  MFA_TEXT,
  OTP_LENGTH,
  extractOtpFromPaste,
  formatCountdown,
  formatRecoveryCodeInput,
  isCompleteOtp,
  isCompleteRecoveryCode,
  isTerminalChallengeError,
  mfaErrorCode,
  mfaErrorMessage,
  normalizeOtpInput,
  recoveryCodesText,
  sessionDeviceLabel,
} from '../src/features/auth/mfa/mfaPolicy.js';
import { hasStepUpHandler, requestStepUp, setStepUpHandler } from '../src/services/stepUpBridge.js';
import { getSecurityPathForUser } from '../src/utils/securityPath.js';
import { getRouteUiPermission } from '../src/utils/rolePermissions.js';
import { flattenAdminNavPaths } from '../src/constants/adminNavigation.js';
import { isSessionEndCode, loginReasonMessage } from '../src/features/auth/session/sessionPolicy.js';

const apiError = (status, code) => ({ response: { status, data: { code } } });

describe('OTP input shaping', () => {
  test('typing keeps digits only and caps at 6', () => {
    assert.equal(OTP_LENGTH, 6);
    assert.equal(normalizeOtpInput('12a3 4-5678'), '123456');
    assert.equal(normalizeOtpInput(null), '');
  });

  test('paste accepts spaced / dashed / prefixed codes', () => {
    assert.equal(extractOtpFromPaste('123456'), '123456');
    assert.equal(extractOtpFromPaste('123 456'), '123456');
    assert.equal(extractOtpFromPaste('123-456'), '123456');
    assert.equal(extractOtpFromPaste('Your code: 654321'), '654321');
  });

  test('paste rejects wrong-length numbers instead of truncating them', () => {
    assert.equal(extractOtpFromPaste('12345'), null);
    assert.equal(extractOtpFromPaste('1234567'), null);
    assert.equal(extractOtpFromPaste(''), null);
    assert.equal(extractOtpFromPaste(undefined), null);
  });

  test('completeness', () => {
    assert.equal(isCompleteOtp('123456'), true);
    assert.equal(isCompleteOtp('12345'), false);
    assert.equal(isCompleteOtp('12345a'), false);
  });
});

describe('recovery code input', () => {
  test('groups into XXXX-XXXX-XXXX and drops ambiguous characters', () => {
    assert.equal(formatRecoveryCodeInput('abcd efgh jkmn'), 'ABCD-EFGH-JKMN');
    assert.equal(formatRecoveryCodeInput('ab'), 'AB');
    // 0, 1, I, O are outside the server alphabet
    assert.equal(formatRecoveryCodeInput('A0B1CIDO'), 'ABCD');
    assert.equal(formatRecoveryCodeInput('ABCDEFGHJKMNPQRS'), 'ABCD-EFGH-JKMN');
  });

  test('completeness matches the server format', () => {
    assert.equal(isCompleteRecoveryCode('ABCD-EFGH-JKMN'), true);
    assert.equal(isCompleteRecoveryCode('ABCD-EFGH-JKM'), false);
    assert.equal(isCompleteRecoveryCode('abcd-efgh-jkmn'), false);
  });
});

describe('MFA error messages', () => {
  test('required Arabic UI texts are present verbatim', () => {
    assert.equal(MFA_TEXT.saveRecoveryCodes, 'احفظ رموز الاسترداد في مكان آمن.');
    assert.equal(MFA_TEXT.recoveryCodesOnce, 'لن تتمكن من رؤيتها مرة أخرى بعد مغادرة هذه الصفحة.');
    assert.equal(MFA_TEXT.useRecoveryCode, 'استخدام رمز استرداد');
  });

  test('maps known codes to safe Arabic messages', () => {
    assert.equal(mfaErrorMessage(apiError(400, 'MFA_CODE_INVALID')), 'رمز التحقق غير صحيح أو انتهت صلاحيته.');
    assert.equal(mfaErrorMessage(apiError(429, 'MFA_TEMPORARILY_LOCKED')), MFA_TEXT.locked);
    assert.equal(mfaErrorMessage(apiError(429, 'SOMETHING_ELSE')), MFA_TEXT.locked);
    assert.equal(mfaErrorMessage(apiError(401, 'MFA_CHALLENGE_INVALID')), MFA_TEXT.challengeExpired);
    assert.equal(mfaErrorMessage(apiError(403, 'MFA_DISABLE_FORBIDDEN')).includes('إلزامية'), true);
  });

  test('never echoes server-provided text; network errors are distinct', () => {
    const leaky = { response: { status: 500, data: { code: 'X', message: 'stack trace secret=ABC' } } };
    assert.equal(mfaErrorMessage(leaky), MFA_TEXT.generic);
    assert.equal(mfaErrorMessage(new Error('Network Error')), MFA_TEXT.network);
    assert.equal(mfaErrorCode(leaky), 'X');
  });

  test('only an invalid/expired challenge is terminal', () => {
    assert.equal(isTerminalChallengeError(apiError(401, 'MFA_CHALLENGE_INVALID')), true);
    assert.equal(isTerminalChallengeError(apiError(400, 'MFA_CODE_INVALID')), false);
    assert.equal(isTerminalChallengeError(apiError(429, 'MFA_TEMPORARILY_LOCKED')), false);
  });
});

describe('formatting helpers', () => {
  test('countdown', () => {
    assert.equal(formatCountdown(300), '5:00');
    assert.equal(formatCountdown(65), '1:05');
    assert.equal(formatCountdown(-3), '0:00');
  });

  test('recovery codes file lists every code once and nothing else secret', () => {
    const codes = ['ABCD-EFGH-JKMN', 'PQRS-TUVW-XYZ2'];
    const text = recoveryCodesText(codes, { accountLabel: 'a***@x.com', generatedAt: '2026-10-15T00:00:00Z' });
    assert.match(text, /01\. ABCD-EFGH-JKMN/);
    assert.match(text, /02\. PQRS-TUVW-XYZ2/);
    assert.match(text, /2026-10-15/);
    assert.doesNotMatch(text, /otpauth|secret/i);
  });

  test('session device label', () => {
    assert.equal(sessionDeviceLabel({ browser: 'Chrome', os: 'Windows' }), 'Chrome على Windows');
    assert.equal(sessionDeviceLabel({ browser: 'Safari' }), 'Safari');
    assert.equal(sessionDeviceLabel({}), 'جهاز غير معروف');
  });
});

describe('step-up bridge', () => {
  test('without a mounted modal the request is declined (no silent retry)', async () => {
    setStepUpHandler(null);
    assert.equal(hasStepUpHandler(), false);
    assert.equal(await requestStepUp({}), false);
  });

  test('concurrent STEP_UP_REQUIRED responses share one prompt', async () => {
    let prompts = 0;
    let release;
    setStepUpHandler(() => {
      prompts += 1;
      return new Promise((resolve) => {
        release = resolve;
      });
    });
    const a = requestStepUp({ maxAgeMinutes: 10 });
    const b = requestStepUp({ maxAgeMinutes: 10 });
    await Promise.resolve();
    release(true);
    assert.deepEqual(await Promise.all([a, b]), [true, true]);
    assert.equal(prompts, 1);
    setStepUpHandler(null);
  });

  test('a throwing handler resolves to false', async () => {
    setStepUpHandler(() => {
      throw new Error('boom');
    });
    assert.equal(await requestStepUp({}), false);
    setStepUpHandler(null);
  });
});

describe('security & sessions routing', () => {
  test('each portal has its own security page', () => {
    assert.equal(getSecurityPathForUser({ role: 'super_admin' }), '/admin/security');
    assert.equal(getSecurityPathForUser({ role: 'admin' }), '/admin/security');
    assert.equal(getSecurityPathForUser({ role: 'student' }), '/student/security');
    assert.equal(getSecurityPathForUser({ role: 'trainee' }), '/trainee/security');
    assert.equal(getSecurityPathForUser({ role: 'instructor' }), '/instructor/security');
    assert.equal(getSecurityPathForUser({ role: 'trainer' }), '/trainer/security');
    assert.equal(getSecurityPathForUser({ role: 'reviewer' }), '/reviewer/security');
    assert.equal(getSecurityPathForUser(null), '/admin/security');
  });

  test('shell UI permission maps the page to the always-available dashboard permission', () => {
    for (const shell of ['student', 'trainee', 'instructor', 'reviewer']) {
      assert.equal(getRouteUiPermission(`/${shell}/security`), 'canViewDashboard');
    }
  });

  test('admin nav exposes the page to super admins and university/institution admins', () => {
    assert.ok(flattenAdminNavPaths('super_admin', { role: 'super_admin', isGlobal: true }).includes('/admin/security'));
    assert.ok(flattenAdminNavPaths('admin', { role: 'admin', organizationType: 'UNIVERSITY' }).includes('/admin/security'));
    assert.ok(flattenAdminNavPaths('admin', { role: 'admin', organizationType: 'INSTITUTION' }).includes('/admin/security'));
  });

  test('MFA_SESSION_REQUIRED ends the local session with an Arabic reason', () => {
    assert.equal(isSessionEndCode('MFA_SESSION_REQUIRED'), true);
    assert.match(loginReasonMessage('MFA_SESSION_REQUIRED'), /التحقق الثنائي/);
  });
});
