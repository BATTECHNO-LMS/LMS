import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth.js';
import { getDefaultDashboardPath } from '../../../utils/authRouting.js';
import { RegisterForm } from '../components/RegisterForm.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import brandLogo from '../../../assets/images/batman-logo.png';

export function RegisterPage() {
  const { t } = useTranslation('auth');
  const { t: tCommon } = useTranslation('common');
  const { isAuthenticated, user, isAuthReady } = useAuth();

  if (!isAuthReady) {
    return <LoadingSpinner />;
  }

  if (isAuthenticated && user) {
    return <Navigate to={getDefaultDashboardPath(user)} replace />;
  }

  return (
    <div className="auth-page auth-register">
      <div className="auth-card auth-register__card">
        <div className="auth-card__brand">
          <img src={brandLogo} alt={tCommon('logo.alt')} className="auth-card__logo" decoding="async" />
        </div>
        <h1 className="auth-card__title">{t('register.title')}</h1>
        <p className="auth-card__subtitle auth-register__description">{t('register.description')}</p>
        <RegisterForm />
      </div>
    </div>
  );
}
