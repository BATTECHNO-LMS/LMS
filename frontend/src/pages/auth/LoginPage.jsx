import { useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { FormInput } from '../../components/forms/FormInput.jsx';
import { FormSelect } from '../../components/forms/FormSelect.jsx';
import { Button } from '../../components/common/Button.jsx';
import { useAuth } from '../../features/auth/index.js';
import { MOCK_PRESET_ORDER } from '../../constants/roles.js';
import { getDashboardPathForRole } from '../../utils/helpers.js';

export function LoginPage() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [presetKey, setPresetKey] = useState(MOCK_PRESET_ORDER[0].key);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (isAuthenticated && user) {
    return <Navigate to={getDashboardPathForRole(user.role)} replace />;
  }

  const selectedPreset = MOCK_PRESET_ORDER.find((p) => p.key === presetKey) ?? MOCK_PRESET_ORDER[0];

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { redirectTo } = await login({
        email,
        password,
        role: selectedPreset.role,
      });
      navigate(from && from !== '/login' ? from : redirectTo, { replace: true });
    } catch {
      setError('تعذّر تسجيل الدخول. حاول مرة أخرى.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">BATTECHNO-LMS</h1>
        <p className="auth-card__subtitle">تسجيل الدخول</p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-form__mock">
            <p className="auth-form__mock-label">وضع تجريبي — اختيار الدور</p>
            <FormSelect
              id="mock-role"
              label="محاكاة الدخول كـ"
              value={presetKey}
              onChange={(e) => setPresetKey(e.target.value)}
            >
              {MOCK_PRESET_ORDER.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.labelAr}
                </option>
              ))}
            </FormSelect>
          </div>

          <FormInput
            id="email"
            type="email"
            name="email"
            label="البريد الإلكتروني"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
          />
          <FormInput
            id="password"
            type="password"
            name="password"
            label="كلمة المرور"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          {error ? <p className="auth-form__error">{error}</p> : null}

          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'جاري الدخول…' : 'دخول'}
          </Button>
        </form>
      </div>
    </div>
  );
}
