/**
 * Map common backend auth messages to i18n; pass through unknown messages (already safe, no stack traces).
 * @param {string} raw
 * @param {(key: string) => string} t — `t` from `useTranslation('auth')`
 */
export function mapAuthErrorToLoginMessage(raw, t) {
  const msg = String(raw || '').trim();
  if (!msg) return t('login.errors.generic');
  const lower = msg.toLowerCase();
  if (lower.includes('invalid credentials')) return t('login.errors.invalidCredentials');
  if (lower.includes('inactive') || lower.includes('suspended')) return t('login.errors.accountInactive');
  return msg;
}
