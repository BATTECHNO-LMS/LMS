/**
 * Pure MFA UI helpers (no React / browser globals) so they can be unit-tested.
 * The backend is authoritative for every decision; these only shape input and messages.
 */

export const OTP_LENGTH = 6;
export const RECOVERY_CODE_GROUPS = 3;
export const RECOVERY_CODE_GROUP_LENGTH = 4;
const RECOVERY_ALPHABET = /[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/;

export const MFA_TEXT = Object.freeze({
  invalidCode: 'رمز التحقق غير صحيح أو انتهت صلاحيته.',
  challengeExpired: 'انتهت صلاحية طلب التحقق. يرجى تسجيل الدخول مرة أخرى.',
  locked: 'تم إيقاف محاولات التحقق مؤقتًا بسبب كثرة المحاولات. يرجى المحاولة لاحقًا.',
  unavailable: 'خدمة المصادقة الثنائية غير متاحة حاليًا. يرجى المحاولة لاحقًا.',
  network: 'تعذر الاتصال بالخادم. تحقق من الاتصال وحاول مرة أخرى.',
  generic: 'تعذر إكمال التحقق. حاول مرة أخرى.',
  passwordInvalid: 'كلمة المرور غير صحيحة.',
  saveRecoveryCodes: 'احفظ رموز الاسترداد في مكان آمن.',
  recoveryCodesOnce: 'لن تتمكن من رؤيتها مرة أخرى بعد مغادرة هذه الصفحة.',
  useRecoveryCode: 'استخدام رمز استرداد',
  useAuthenticator: 'استخدام تطبيق المصادقة',
});

const ERROR_MESSAGES = Object.freeze({
  MFA_CODE_INVALID: MFA_TEXT.invalidCode,
  MFA_CHALLENGE_INVALID: MFA_TEXT.challengeExpired,
  MFA_TEMPORARILY_LOCKED: MFA_TEXT.locked,
  MFA_UNAVAILABLE: MFA_TEXT.unavailable,
  PASSWORD_CONFIRMATION_INVALID: MFA_TEXT.passwordInvalid,
  MFA_DISABLE_FORBIDDEN: 'المصادقة الثنائية إلزامية لهذا الحساب ولا يمكن إيقافها.',
  MFA_NOT_ENABLED: 'المصادقة الثنائية غير مفعّلة لهذا الحساب. فعّلها من صفحة الأمان والجلسات.',
  MFA_ALREADY_ENABLED: 'المصادقة الثنائية مفعّلة مسبقًا.',
  RATE_LIMIT: MFA_TEXT.locked,
});

/** Codes after which the login challenge cannot continue (user must sign in again). */
const TERMINAL_CHALLENGE_CODES = new Set(['MFA_CHALLENGE_INVALID']);

/** Digits only, at most 6 (typing). */
export function normalizeOtpInput(value) {
  return String(value ?? '')
    .replace(/\D/g, '')
    .slice(0, OTP_LENGTH);
}

/** A pasted "123 456" / "123-456" / "Your code: 123456" → "123456"; otherwise null. */
export function extractOtpFromPaste(text) {
  const compact = String(text ?? '').replace(/[\s-]/g, '');
  const match = compact.match(new RegExp(`(?<!\\d)\\d{${OTP_LENGTH}}(?!\\d)`));
  return match ? match[0] : null;
}

export function isCompleteOtp(value) {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(String(value ?? ''));
}

/** Uppercase, alphabet-only, grouped XXXX-XXXX-XXXX while typing/pasting. */
export function formatRecoveryCodeInput(value) {
  const chars = String(value ?? '')
    .toUpperCase()
    .split('')
    .filter((c) => RECOVERY_ALPHABET.test(c))
    .slice(0, RECOVERY_CODE_GROUPS * RECOVERY_CODE_GROUP_LENGTH)
    .join('');
  const groups = chars.match(new RegExp(`.{1,${RECOVERY_CODE_GROUP_LENGTH}}`, 'g')) || [];
  return groups.join('-');
}

export function isCompleteRecoveryCode(value) {
  return /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(String(value ?? ''));
}

export function mfaErrorCode(error) {
  return error?.response?.data?.code || null;
}

/** Safe Arabic message for an MFA API error (never echoes server internals). */
export function mfaErrorMessage(error) {
  if (error && !error.response) return MFA_TEXT.network;
  const code = mfaErrorCode(error);
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (error?.response?.status === 429) return MFA_TEXT.locked;
  return MFA_TEXT.generic;
}

export function isTerminalChallengeError(error) {
  return TERMINAL_CHALLENGE_CODES.has(mfaErrorCode(error));
}

/** "4:05" style countdown for the challenge validity. */
export function formatCountdown(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** Plain-text file content for "download recovery codes" (no account secrets besides the codes). */
export function recoveryCodesText(codes, { issuer = 'eprojecto', accountLabel = '', generatedAt = new Date() } = {}) {
  const lines = [
    `${issuer} — رموز الاسترداد / Recovery codes`,
    accountLabel ? `الحساب: ${accountLabel}` : null,
    `تاريخ الإنشاء: ${new Date(generatedAt).toISOString().slice(0, 10)}`,
    '',
    ...codes.map((c, i) => `${String(i + 1).padStart(2, '0')}. ${c}`),
    '',
    'كل رمز يُستخدم مرة واحدة فقط. احفظ هذا الملف في مكان آمن.',
  ];
  return lines.filter((l) => l !== null).join('\n');
}

/** Arabic label for a device/session row produced by GET /auth/sessions. */
export function sessionDeviceLabel(session) {
  if (session?.browser && session?.os) return `${session.browser} على ${session.os}`;
  return session?.browser || session?.os || 'جهاز غير معروف';
}
