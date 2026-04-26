import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { FormInput } from '../../components/forms/FormInput.jsx';
import { Button } from '../../components/common/Button.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { useAuth } from '../../features/auth/index.js';
import { getDefaultDashboardPath } from '../../utils/authRouting.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';
import { mapAuthErrorToLoginMessage } from '../../utils/authErrors.js';
import brandLogo from '../../assets/images/batman-logo.png';

export function LoginPage({ forcedRole = null, forcedRoleLabelAr = '', forcedRoleLabelEn = '' }) {
  const { t, i18n } = useTranslation('auth');
  const { t: tCommon } = useTranslation('common');
  const { login, isAuthenticated, user, isAuthReady } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const from = location.state?.from?.pathname;
  const registrationPendingNotice = searchParams.get('registered') === 'pending';

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  const loginSchema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .min(1, t('login.errors.emailRequired'))
          .email(t('login.errors.invalidEmail')),
        password: z.string().min(1, t('login.errors.passwordRequired')),
      }),
    [t, i18n.language]
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  if (!isAuthReady) {
    return <LoadingSpinner />;
  }

  if (isAuthenticated && user) {
    return <Navigate to={getDefaultDashboardPath(user)} replace />;
  }

  async function onSubmit(values) {
    setServerError('');
    setSubmitting(true);
    try {
      const { redirectTo } = await login({ email: values.email.trim(), password: values.password });
      navigate(from && from !== '/login' ? from : redirectTo, { replace: true });
    } catch (err) {
      if (!err?.response) {
        setServerError(t('login.errors.network'));
      } else {
        const raw = getApiErrorMessage(err, t('login.errors.generic'));
        setServerError(mapAuthErrorToLoginMessage(raw, t));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const portalLabel = i18n.language?.startsWith('ar') ? forcedRoleLabelAr : forcedRoleLabelEn;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__brand">
          <img src={brandLogo} alt={tCommon('logo.alt')} className="auth-card__logo" decoding="async" />
        </div>
        <h1 className="auth-card__title">{t('login.brandTitle')}</h1>
        <p className="auth-card__subtitle">{t('login.title')}</p>
        <p className="text-muted small mb-3">{t('login.subtitle')}</p>

        <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          {registrationPendingNotice ? (
            <p className="auth-register__helper" role="status" style={{ marginBottom: 12 }}>
              {t('register.pendingApproval')}
            </p>
          ) : null}
          {forcedRole ? (
            <div className="auth-form__portal">
              <p className="auth-form__portal-label">{t('login.portalHint')}</p>
              <FormInput
                id="portal-role"
                label={t('login.roleLabel')}
                value={portalLabel}
                readOnly
              />
            </div>
          ) : null}

          <FormInput
            id="email"
            type="email"
            name="email"
            label={t('login.email')}
            autoComplete="username"
            placeholder={t('login.placeholders.email')}
            error={errors.email?.message}
            {...register('email')}
          />
          <FormInput
            id="password"
            type="password"
            name="password"
            label={t('login.password')}
            autoComplete="current-password"
            placeholder={t('login.placeholders.password')}
            error={errors.password?.message}
            {...register('password')}
          />

          {serverError ? <p className="auth-form__error">{serverError}</p> : null}

          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? t('login.submitting') : t('login.submit')}
          </Button>
        </form>
      </div>
    </div>
  );
}
