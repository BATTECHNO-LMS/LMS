import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth.js';
import { getDashboardPathForRole } from '../../../utils/helpers.js';
import { RegisterForm } from '../components/RegisterForm.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';

export function RegisterPage() {
  const { t } = useTranslation('auth');
  const { isAuthenticated, user, isAuthReady } = useAuth();

  if (!isAuthReady) {
    return <LoadingSpinner />;
  }

  if (isAuthenticated && user) {
    return <Navigate to={getDashboardPathForRole(user.role)} replace />;
  }

  return (
    <div className="auth-page auth-register">
      <div className="auth-card auth-register__card">
        <h1 className="auth-card__title">{t('register.title')}</h1>
        <p className="auth-card__subtitle auth-register__description">{t('register.description')}</p>
        <RegisterForm />
      </div>
    </div>
  );
}
