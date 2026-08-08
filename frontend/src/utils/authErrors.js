/**
 * Map common backend auth messages to i18n; pass through unknown messages (already safe, no stack traces).
 * @param {string} raw
 * @param {(key: string) => string} t — `t` from `useTranslation('auth')`
 */
export function mapAuthErrorToLoginMessage(raw, t, err) {
  const code = err?.response?.data?.code;
  if (code === 'EMAIL_NOT_VERIFIED') return t('login.errors.emailNotVerified');
  if (code === 'INVALID_CREDENTIALS') return t('login.errors.invalidCredentials');
  if (code === 'ACCOUNT_PENDING_ACTIVATION') return t('login.errors.accountPendingActivation');
  if (code === 'ACCOUNT_DISABLED') return t('login.errors.accountDisabled');
  if (code === 'ACCOUNT_REJECTED') return t('login.errors.accountRejected');
  if (code === 'ACCOUNT_INACTIVE') return t('login.errors.accountInactive');
  if (code === 'PORTAL_MISMATCH') {
    return err?.response?.data?.message || t('login.errors.portalMismatch');
  }
  if (code === 'SERVER_ERROR') return t('login.errors.generic');
  if (code === 'OTP_RATE_LIMITED' || code === 'OTP_RESEND_COOLDOWN') return t('verifyEmail.errors.rateLimited');
  const msg = String(raw || '').trim();
  if (!msg) return t('login.errors.generic');
  const lower = msg.toLowerCase();
  if (lower.includes('invalid credentials')) return t('login.errors.invalidCredentials');
  if (lower.includes('توثيق البريد') || (lower.includes('email') && lower.includes('verif'))) {
    return t('login.errors.emailNotVerified');
  }
  if (lower.includes('not activated') || lower.includes('admin approval')) {
    return t('login.errors.accountPendingActivation');
  }
  if (lower.includes('inactive') || lower.includes('suspended')) return t('login.errors.accountInactive');
  return t('login.errors.generic');
}
