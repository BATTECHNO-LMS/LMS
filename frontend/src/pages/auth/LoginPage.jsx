import { useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { FormInput } from '../../components/forms/FormInput.jsx';
import { Button } from '../../components/common/Button.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { useAuth } from '../../features/auth/index.js';
import { useLocale } from '../../features/locale/index.js';
import { getDashboardPathForRole } from '../../utils/helpers.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

export function LoginPage({ forcedRole: _forcedRole = null, forcedRoleLabelAr = '', forcedRoleLabelEn = '' }) {
  const { login, isAuthenticated, user, isAuthReady } = useAuth();
  const { locale } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isAuthReady) {
    return <LoadingSpinner />;
  }

  if (isAuthenticated && user) {
    return <Navigate to={getDashboardPathForRole(user.role)} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { redirectTo } = await login({ email, password });
      navigate(from && from !== '/login' ? from : redirectTo, { replace: true });
    } catch (err) {
      const fallback =
        locale === 'ar'
          ? 'تعذّر تسجيل الدخول. تحقق من البيانات أو من تشغيل الخادم.'
          : 'Login failed. Check your credentials or that the API is running.';
      setError(getApiErrorMessage(err, fallback));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">BATTECHNO-LMS</h1>
        <p className="auth-card__subtitle">{locale === 'ar' ? 'تسجيل الدخول' : 'Sign in'}</p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {forcedRole ? (
            <div className="auth-form__mock">
              <p className="auth-form__mock-label">{locale === 'ar' ? 'بوابة الدخول' : 'Portal login'}</p>
              <FormInput
                id="portal-role"
                label={locale === 'ar' ? 'الدور' : 'Role'}
                value={locale === 'ar' ? forcedRoleLabelAr : forcedRoleLabelEn}
                readOnly
              />
            </div>
          ) : null}

          <FormInput
            id="email"
            type="email"
            name="email"
            label={locale === 'ar' ? 'البريد الإلكتروني' : 'Email'}
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
          />
          <FormInput
            id="password"
            type="password"
            name="password"
            label={locale === 'ar' ? 'كلمة المرور' : 'Password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          {error ? <p className="auth-form__error">{error}</p> : null}

          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? (locale === 'ar' ? 'جاري الدخول…' : 'Signing in...') : locale === 'ar' ? 'دخول' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
