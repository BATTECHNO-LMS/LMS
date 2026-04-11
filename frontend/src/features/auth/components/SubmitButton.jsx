import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function SubmitButton({ loading, disabled, children }) {
  const { t } = useTranslation('auth');

  return (
    <button
      type="submit"
      className="btn btn--primary auth-register__submit"
      disabled={disabled || loading}
    >
      {loading ? (
        <>
          <Loader2 className="auth-register__submit-icon" aria-hidden />
          <span>{t('register.submitting')}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
