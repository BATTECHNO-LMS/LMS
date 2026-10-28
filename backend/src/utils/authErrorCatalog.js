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
  EMAIL_DELIVERY_FAILED: 'EMAIL_DELIVERY_FAILED',
  UNIVERSITY_NOT_FOUND: 'UNIVERSITY_NOT_FOUND',
  UNIVERSITY_SPECIALTY_MISMATCH: 'UNIVERSITY_SPECIALTY_MISMATCH',
  SPECIALTY_INVALID: 'SPECIALTY_INVALID',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  PORTAL_MISMATCH: 'PORTAL_MISMATCH',
  PORTAL_REQUIRED: 'PORTAL_REQUIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_ENDED: 'SESSION_ENDED',
  SESSION_IDLE_TIMEOUT: 'SESSION_IDLE_TIMEOUT',
  SESSION_ABSOLUTE_EXPIRED: 'SESSION_ABSOLUTE_EXPIRED',
  /** Login state (not an error): password verified, MFA code required. */
  MFA_REQUIRED: 'MFA_REQUIRED',
  /** Login state (not an error): password verified, MFA enrollment required before any session. */
  MFA_ENROLLMENT_REQUIRED: 'MFA_ENROLLMENT_REQUIRED',
  MFA_CODE_INVALID: 'MFA_CODE_INVALID',
  MFA_CHALLENGE_INVALID: 'MFA_CHALLENGE_INVALID',
  MFA_TEMPORARILY_LOCKED: 'MFA_TEMPORARILY_LOCKED',
  /** 401: a privileged account's session lacks MFA assurance → fresh login required. */
  MFA_SESSION_REQUIRED: 'MFA_SESSION_REQUIRED',
  MFA_NOT_ENABLED: 'MFA_NOT_ENABLED',
  MFA_ALREADY_ENABLED: 'MFA_ALREADY_ENABLED',
  MFA_DISABLE_FORBIDDEN: 'MFA_DISABLE_FORBIDDEN',
  MFA_UNAVAILABLE: 'MFA_UNAVAILABLE',
  PASSWORD_CONFIRMATION_INVALID: 'PASSWORD_CONFIRMATION_INVALID',
  /** 403: the operation needs a recent MFA verification on this session. */
  STEP_UP_REQUIRED: 'STEP_UP_REQUIRED',
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
  [AUTH_ERROR_CODES.EMAIL_DELIVERY_FAILED]:
    'تعذر إرسال رمز التحقق إلى بريدك حاليًا. حاول طلب رمز جديد بعد قليل.',
  [AUTH_ERROR_CODES.UNIVERSITY_NOT_FOUND]:
    'الجامعة المحددة غير متاحة. اختر جامعة أخرى أو تواصل مع الدعم.',
  [AUTH_ERROR_CODES.UNIVERSITY_SPECIALTY_MISMATCH]:
    'التخصص المحدد غير مرتبط بالجامعة المختارة.',
  [AUTH_ERROR_CODES.SPECIALTY_INVALID]:
    'التخصص المحدد غير متاح لهذه الجامعة.',
  [AUTH_ERROR_CODES.SERVER_ERROR]:
    'تعذر إكمال العملية حاليًا. حاول مرة أخرى بعد قليل، وإذا استمرت المشكلة تواصل مع الدعم.',
  [AUTH_ERROR_CODES.UNAUTHORIZED]:
    'انتهت جلستك أو غير مصرح لك. سجّل الدخول مرة أخرى.',
  [AUTH_ERROR_CODES.VALIDATION_ERROR]:
    'يرجى مراجعة الحقول المظللة وتصحيحها.',
  [AUTH_ERROR_CODES.PORTAL_MISMATCH]:
    'هذا الحساب مرتبط ببوابة مختلفة. يرجى تسجيل الدخول من البوابة المناسبة.',
  [AUTH_ERROR_CODES.PORTAL_REQUIRED]:
    'يرجى تسجيل الدخول من بوابة الجامعات أو بوابة المؤسسات.',
  [AUTH_ERROR_CODES.TOKEN_INVALID]:
    'انتهت جلستك أو غير مصرح لك. سجّل الدخول مرة أخرى.',
  [AUTH_ERROR_CODES.TOKEN_EXPIRED]:
    'انتهت صلاحية جلستك. يرجى تسجيل الدخول مرة أخرى.',
  [AUTH_ERROR_CODES.SESSION_NOT_FOUND]:
    'انتهت جلستك. يرجى تسجيل الدخول مرة أخرى.',
  [AUTH_ERROR_CODES.SESSION_ENDED]:
    'تم إنهاء جلستك. يرجى تسجيل الدخول مرة أخرى.',
  [AUTH_ERROR_CODES.SESSION_IDLE_TIMEOUT]:
    'انتهت جلستك بسبب عدم النشاط لمدة 30 دقيقة. يرجى تسجيل الدخول مرة أخرى.',
  [AUTH_ERROR_CODES.SESSION_ABSOLUTE_EXPIRED]:
    'انتهت المدة القصوى لجلستك. يرجى تسجيل الدخول مرة أخرى.',
  [AUTH_ERROR_CODES.MFA_REQUIRED]: 'أدخل رمز التحقق من تطبيق المصادقة لإكمال تسجيل الدخول.',
  [AUTH_ERROR_CODES.MFA_ENROLLMENT_REQUIRED]:
    'يتطلب حسابك إعداد المصادقة الثنائية قبل المتابعة.',
  [AUTH_ERROR_CODES.MFA_CODE_INVALID]: 'رمز التحقق غير صحيح أو انتهت صلاحيته.',
  [AUTH_ERROR_CODES.MFA_CHALLENGE_INVALID]:
    'انتهت صلاحية طلب التحقق. يرجى تسجيل الدخول مرة أخرى.',
  [AUTH_ERROR_CODES.MFA_TEMPORARILY_LOCKED]:
    'تم إيقاف محاولات التحقق مؤقتًا بسبب كثرة المحاولات. يرجى المحاولة لاحقًا.',
  [AUTH_ERROR_CODES.MFA_SESSION_REQUIRED]:
    'يتطلب حسابك التحقق الثنائي. يرجى تسجيل الدخول مرة أخرى.',
  [AUTH_ERROR_CODES.MFA_NOT_ENABLED]: 'المصادقة الثنائية غير مفعّلة لهذا الحساب.',
  [AUTH_ERROR_CODES.MFA_ALREADY_ENABLED]: 'المصادقة الثنائية مفعّلة مسبقًا.',
  [AUTH_ERROR_CODES.MFA_DISABLE_FORBIDDEN]:
    'المصادقة الثنائية إلزامية لهذا الحساب ولا يمكن إيقافها.',
  [AUTH_ERROR_CODES.MFA_UNAVAILABLE]: 'خدمة المصادقة الثنائية غير متاحة حاليًا.',
  [AUTH_ERROR_CODES.PASSWORD_CONFIRMATION_INVALID]: 'كلمة المرور غير صحيحة.',
  [AUTH_ERROR_CODES.STEP_UP_REQUIRED]:
    'يتطلب هذا الإجراء إعادة التحقق من هويتك باستخدام تطبيق المصادقة.',
  PORTAL_MISMATCH_UNIVERSITY:
    'هذا الحساب مرتبط ببوابة الجامعات. يرجى تسجيل الدخول من بوابة الجامعات.',
  PORTAL_MISMATCH_INSTITUTION:
    'هذا الحساب مرتبط ببوابة المؤسسات. يرجى تسجيل الدخول من بوابة المؤسسات.',
});

const ACTIVATION_SLA_HOURS = 48;

function messageForCode(code, fallback) {
  if (code === AUTH_ERROR_CODES.SESSION_IDLE_TIMEOUT) {
    const minutes = require('../config/env').env.AUTH_IDLE_TIMEOUT_MINUTES;
    return `انتهت جلستك بسبب عدم النشاط لمدة ${minutes} دقيقة. يرجى تسجيل الدخول مرة أخرى.`;
  }
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
