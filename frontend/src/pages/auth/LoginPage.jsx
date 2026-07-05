import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import { FormInput } from '../../components/forms/FormInput.jsx';
import { Button } from '../../components/common/Button.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { useAuth } from '../../features/auth/index.js';
import { getDefaultDashboardPath } from '../../utils/authRouting.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';
import { mapAuthErrorToLoginMessage } from '../../utils/authErrors.js';
import { ROLES } from '../../constants/roles.js';
import { BrandLogo } from '../../components/common/BrandLogo.jsx';
import { AuthVisualPanel } from './AuthVisualPanel.jsx';
import { AuthBackgroundDecor } from './AuthBackgroundDecor.jsx';
import { AUTH_MOTION_EASE } from './authMotion.js';
import loginIllustration from '../../assets/landing/illustrations/hero-student-learning.svg';

const EASE = AUTH_MOTION_EASE;

export function LoginPage({ forcedRole = null, forcedRoleLabelAr = '', forcedRoleLabelEn = '' }) {
  const { t, i18n } = useTranslation('auth');
  const { t: tCommon } = useTranslation('common');
  const { login, isAuthenticated, user, isAuthReady } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const from = location.state?.from?.pathname;
  const registrationPendingNotice = searchParams.get('registered') === 'pending';
  const reduced = useReducedMotion();

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
        setServerError(mapAuthErrorToLoginMessage(raw, t, err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const portalLabel = i18n.language?.startsWith('ar') ? forcedRoleLabelAr : forcedRoleLabelEn;
  const showStudentSignUp = !forcedRole || forcedRole === ROLES.STUDENT;

  const formMotion = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.55, ease: EASE },
      };

  const fieldMotion = (delay) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.4, delay, ease: EASE },
        };

  return (
    <div className="auth-page auth-page--split auth-page--login">
      <AuthBackgroundDecor />

      <div className="auth-split-wrap">
        <span className="auth-split__halo" aria-hidden />
        <div className="auth-split">
        <motion.section className="auth-split__form" {...formMotion}>
          <div className="auth-split__form-inner">
            <BrandLogo variant="auth" alt={tCommon('logo.alt')} className="auth-split__logo" />

            <header className="auth-split__header">
              <h1 className="auth-split__title">{t('login.welcomeTitle')}</h1>
              <p className="auth-split__subtitle">{t('login.welcomeSubtitle')}</p>
            </header>

            <form className="auth-form auth-form--login" onSubmit={handleSubmit(onSubmit)} noValidate>
              {registrationPendingNotice ? (
                <p className="auth-register__helper" role="status">
                  {t('register.pendingApproval')}
                </p>
              ) : null}

              {forcedRole ? (
                <motion.div {...fieldMotion(0.1)} className="auth-form__portal">
                  <p className="auth-form__portal-label">{t('login.portalHint')}</p>
                  <FormInput
                    id="portal-role"
                    label={t('login.roleLabel')}
                    value={portalLabel}
                    readOnly
                  />
                </motion.div>
              ) : null}

              <motion.div {...fieldMotion(forcedRole ? 0.14 : 0.1)}>
                <FormInput
                  id="email"
                  type="email"
                  name="email"
                  label={t('login.email')}
                  autoComplete="username"
                  placeholder={t('login.placeholders.email')}
                  error={errors.email?.message}
                  inputClassName="auth-form__input"
                  {...register('email')}
                />
              </motion.div>

              <motion.div {...fieldMotion(forcedRole ? 0.18 : 0.14)}>
                <FormInput
                  id="password"
                  type="password"
                  name="password"
                  label={t('login.password')}
                  autoComplete="current-password"
                  placeholder={t('login.placeholders.password')}
                  error={errors.password?.message}
                  passwordToggle
                  inputClassName="auth-form__input"
                  {...register('password')}
                />
              </motion.div>

              {serverError ? <p className="auth-form__error">{serverError}</p> : null}

              <motion.div {...fieldMotion(forcedRole ? 0.22 : 0.18)} className="auth-form__actions">
                <Button type="submit" variant="primary" disabled={submitting} className="auth-form__submit">
                  {submitting ? t('login.submitting') : t('login.submit')}
                </Button>
              </motion.div>

              {showStudentSignUp ? (
                <motion.p {...fieldMotion(forcedRole ? 0.26 : 0.22)} className="auth-form__sign-up-row">
                  <span>{t('login.signUpPrompt')}</span>{' '}
                  <Link className="auth-form__sign-up-link" to="/register">
                    {t('login.signUpLink')}
                  </Link>
                </motion.p>
              ) : null}
            </form>
          </div>
        </motion.section>

        <AuthVisualPanel
          illustration={loginIllustration}
          titleKey="login.panelTitle"
          subtitleKey="login.panelSubtitle"
        />
        </div>
      </div>
    </div>
  );
}
