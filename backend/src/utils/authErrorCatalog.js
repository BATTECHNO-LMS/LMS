'use strict';

/**
 * Stable auth/account error codes + Arabic user-facing messages.
 * Technical details never go in `message` — only in server logs.
 */

const AUTH_ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  PHONE_ALREADY_EXISTS: 'PHONE_ALREADY_EXISTS',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  ACCOUNT_PENDING_ACTIVATION: 'ACCOUNT_PENDING_ACTIVATION',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  ACCOUNT_REJECTED: 'ACCOUNT_REJECTED',
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  INVALID_OTP: 'INVALID_OTP',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_RATE_LIMITED: 'OTP_RATE_LIMITED',
  OTP_RESEND_COOLDOWN: 'OTP_RESEND_COOLDOWN',
  PASSWORD_TOO_WEAK: 'PASSWORD_TOO_WEAK',
  EMAIL_DOMAIN_MISMATCH: 'EMAIL_DOMAIN_MISMATCH',
  UNIVERSITY_NOT_FOUND: 'UNIVERSITY_NOT_FOUND',
  SPECIALTY_INVALID: 'SPECIALTY_INVALID',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
});

const AUTH_MESSAGES = Object.freeze({
  [AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS]:
    'يوجد حساب مسجل بهذا البريد. يمكنك تسجيل الدخول أو استخدام خيار استعادة كلمة المرور.',
  [AUTH_ERROR_CODES.PHONE_ALREADY_EXISTS]:
    'يوجد حساب مرتبط بهذا الرقم. تحقق من الرقم أو تواصل مع الدعم.',
  [AUTH_ERROR_CODES.INVALID_CREDENTIALS]:
    'البريد الإلكتروني أو كلمة المرور غير صحيحة. تحقق من البيانات وحاول مرة أخرى.',
  [AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED]:
    'يجب توثيق بريدك الإلكتروني قبل متابعة تسجيل الدخول. يمكنك طلب رمز تحقق جديد.',
  [AUTH_ERROR_CODES.ACCOUNT_PENDING_ACTIVATION]:
    'بيانات تسجيل الدخول صحيحة، لكن حسابك ما زال بانتظار تفعيل الإدارة. سيتم التفعيل خلال مدة لا تتجاوز 48 ساعة.',
  [AUTH_ERROR_CODES.ACCOUNT_DISABLED]:
    'لا يمكنك تسجيل الدخول حاليًا. تواصل مع الدعم لمعرفة حالة الحساب.',
  [AUTH_ERROR_CODES.ACCOUNT_REJECTED]:
    'لم تتم الموافقة على الحساب. راجع بياناتك أو تواصل مع الدعم لمعرفة السبب.',
  [AUTH_ERROR_CODES.ACCOUNT_NOT_FOUND]:
    'تعذر العثور على الحساب. تحقق من البيانات وحاول مرة أخرى.',
  [AUTH_ERROR_CODES.ACCOUNT_INACTIVE]:
    'لا يمكنك تسجيل الدخول حاليًا. تواصل مع الدعم لمعرفة حالة الحساب.',
  [AUTH_ERROR_CODES.INVALID_OTP]:
    'تحقق من الرمز المرسل إلى بريدك وأدخله مرة أخرى.',
  [AUTH_ERROR_CODES.OTP_EXPIRED]:
    'انتهت صلاحية رمز التحقق. اطلب رمزًا جديدًا للمتابعة.',
  [AUTH_ERROR_CODES.OTP_RATE_LIMITED]:
    'تم تجاوز عدد المحاولات المسموح. اطلب رمزًا جديدًا للمتابعة.',
  [AUTH_ERROR_CODES.OTP_RESEND_COOLDOWN]:
    'تم إرسال عدة طلبات خلال وقت قصير. انتظر قليلًا قبل طلب رمز تحقق جديد.',
  [AUTH_ERROR_CODES.PASSWORD_TOO_WEAK]:
    'كلمة المرور يجب أن تحتوي على 8 أحرف على الأقل.',
  [AUTH_ERROR_CODES.EMAIL_DOMAIN_MISMATCH]:
    'البريد الإلكتروني لا يطابق نطاقات الجامعة المحددة. استخدم بريدك الجامعي الرسمي.',
  [AUTH_ERROR_CODES.UNIVERSITY_NOT_FOUND]:
    'الجامعة المحددة غير متاحة. اختر جامعة أخرى أو تواصل مع الدعم.',
  [AUTH_ERROR_CODES.SPECIALTY_INVALID]:
    'التخصص المحدد غير متاح لهذه الجامعة.',
  [AUTH_ERROR_CODES.SERVER_ERROR]:
    'تعذر إكمال العملية حاليًا. حاول مرة أخرى بعد قليل، وإذا استمرت المشكلة تواصل مع الدعم.',
  [AUTH_ERROR_CODES.UNAUTHORIZED]:
    'انتهت جلستك أو غير مصرح لك. سجّل الدخول مرة أخرى.',
  [AUTH_ERROR_CODES.VALIDATION_ERROR]:
    'يرجى مراجعة الحقول المظللة وتصحيحها.',
});

const ACTIVATION_SLA_HOURS = 48;

function messageForCode(code, fallback) {
  return AUTH_MESSAGES[code] || fallback || AUTH_MESSAGES[AUTH_ERROR_CODES.SERVER_ERROR];
}

/**
 * Mask email for safe display: ba***@example.com
 */
function maskEmail(email) {
  const raw = String(email || '').trim().toLowerCase();
  const at = raw.indexOf('@');
  if (at < 1) return '***';
  const local = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

/**
 * Activation wait clock starts after email verification when available, else registration time.
 * @param {{ created_at?: Date|string|null, email_verified_at?: Date|string|null }} user
 */
function resolveActivationClockStart(user) {
  const verified = user?.email_verified_at ? new Date(user.email_verified_at) : null;
  if (verified && !Number.isNaN(verified.getTime())) return verified;
  const created = user?.created_at ? new Date(user.created_at) : null;
  if (created && !Number.isNaN(created.getTime())) return created;
  return null;
}

function buildActivationWaitMeta(user, now = new Date()) {
  const start = resolveActivationClockStart(user);
  if (!start) {
    return {
      hoursPending: 0,
      overdue48h: false,
      expectedWithinHours: ACTIVATION_SLA_HOURS,
      clockStartedAt: null,
    };
  }
  const ms = Math.max(0, now.getTime() - start.getTime());
  const hoursPending = Math.floor(ms / (60 * 60 * 1000));
  return {
    hoursPending,
    overdue48h: hoursPending >= ACTIVATION_SLA_HOURS,
    expectedWithinHours: ACTIVATION_SLA_HOURS,
    clockStartedAt: start.toISOString(),
  };
}

/**
 * Safe details attached to account-gate errors (no secrets).
 */
function buildAccountGateDetails(user) {
  const wait = buildActivationWaitMeta(user);
  return {
    maskedEmail: maskEmail(user.email),
    emailVerified: Boolean(user.email_verified_at),
    accountStatus: user.status,
    createdAt: user.created_at ? new Date(user.created_at).toISOString() : null,
    emailVerifiedAt: user.email_verified_at
      ? new Date(user.email_verified_at).toISOString()
      : null,
    ...wait,
    canResendOtp: !user.email_verified_at,
    publicReason:
      user.status === 'rejected' && user.status_public_message
        ? String(user.status_public_message).slice(0, 500)
        : null,
  };
}

module.exports = {
  AUTH_ERROR_CODES,
  AUTH_MESSAGES,
  ACTIVATION_SLA_HOURS,
  messageForCode,
  maskEmail,
  resolveActivationClockStart,
  buildActivationWaitMeta,
  buildAccountGateDetails,
};
