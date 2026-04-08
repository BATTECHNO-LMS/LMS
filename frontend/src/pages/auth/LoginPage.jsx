import { useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { FormInput } from '../../components/forms/FormInput.jsx';
import { FormSelect } from '../../components/forms/FormSelect.jsx';
import { Button } from '../../components/common/Button.jsx';
import { useAuth } from '../../features/auth/index.js';
import { useLocale } from '../../features/locale/index.js';
import { AUTH_MOCK_SCENARIO_ORDER } from '../../constants/authMockScenarios.js';
import { getDashboardPathForRole } from '../../utils/helpers.js';

export function LoginPage({ forcedRole = null, forcedRoleLabelAr = '', forcedRoleLabelEn = '' }) {
  const { login, isAuthenticated, user } = useAuth();
  const { locale } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [scenarioKey, setScenarioKey] = useState(AUTH_MOCK_SCENARIO_ORDER[0].key);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (isAuthenticated && user) {
    return <Navigate to={getDashboardPathForRole(user.role)} replace />;
  }

  const selectedScenario = forcedRole
    ? AUTH_MOCK_SCENARIO_ORDER.find((s) => s.role === forcedRole) ?? AUTH_MOCK_SCENARIO_ORDER[0]
    : AUTH_MOCK_SCENARIO_ORDER.find((s) => s.key === scenarioKey) ?? AUTH_MOCK_SCENARIO_ORDER[0];
  const selectedRole = forcedRole ?? selectedScenario.role;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { redirectTo } = await login({
        email,
        password,
        role: selectedRole,
        scenarioKey: forcedRole ? selectedScenario.key : scenarioKey,
      });
      navigate(from && from !== '/login' ? from : redirectTo, { replace: true });
    } catch {
      setError(locale === 'ar' ? 'تعذّر تسجيل الدخول. حاول مرة أخرى.' : 'Login failed. Please try again.');
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
          <div className="auth-form__mock">
            {forcedRole ? (
              <>
                <p className="auth-form__mock-label">{locale === 'ar' ? 'بوابة الدخول' : 'Portal login'}</p>
                <FormInput
                  id="portal-role"
                  label={locale === 'ar' ? 'الدور' : 'Role'}
                  value={locale === 'ar' ? forcedRoleLabelAr : forcedRoleLabelEn}
                  readOnly
                />
              </>
            ) : (
              <>
                <p className="auth-form__mock-label">
                  {locale === 'ar' ? 'وضع تجريبي — اختيار السيناريو (جامعة / نطاق)' : 'Demo mode — scenario (university / scope)'}
                </p>
                <FormSelect
                  id="mock-scenario"
                  label={locale === 'ar' ? 'محاكاة الدخول كـ' : 'Simulate login as'}
                  value={scenarioKey}
                  onChange={(e) => setScenarioKey(e.target.value)}
                >
                  {AUTH_MOCK_SCENARIO_ORDER.map((s) => (
                    <option key={s.key} value={s.key}>
                      {locale === 'ar' ? s.labelAr : s.labelEn}
                    </option>
                  ))}
                </FormSelect>
              </>
            )}
          </div>

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
