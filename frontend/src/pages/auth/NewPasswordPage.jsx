import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import { FormInput } from '../../components/forms/FormInput.jsx';
import { Button } from '../../components/common/Button.jsx';
import { BrandLogo } from '../../components/common/BrandLogo.jsx';
import { AuthBackgroundDecor } from './AuthBackgroundDecor.jsx';
import { AuthVisualPanel } from './AuthVisualPanel.jsx';
import { AUTH_MOTION_EASE } from './authMotion.js';
import { resetPassword } from '../../features/auth/auth.service.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';
import { getStorageItem, removeStorageItem, storageKeys } from '../../utils/storage.js';
import loginIllustration from '../../assets/landing/illustrations/hero-student-learning.svg';

function readResetToken() {
  try {
    const raw = sessionStorage.getItem(storageKeys.passwordResetToken);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export function NewPasswordPage() {
  const { t, i18n } = useTranslation('auth');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const location = useLocation();
  const reduced = useReducedMotion();

  const email = useMemo(() => {
    const fromState = location.state?.email?.trim().toLowerCase();
    if (fromState) return fromState;
    const stored = getStorageItem(storageKeys.pendingPasswordResetEmail);
    return typeof stored === 'string' ? stored : '';
  }, [location.state]);

  const [resetToken] = useState(() => readResetToken());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const schema = useMemo(
    () =>
      z
        .object({
          newPassword: z.string().min(8, t('resetPasswordNew.errors.passwordShort')),
          confirmPassword: z.string().min(8, t('resetPasswordNew.errors.passwordShort')),
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
          message: t('resetPasswordNew.errors.passwordMismatch'),
          path: ['confirmPassword'],
        }),
    [t, i18n.language]
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (!email || !resetToken) {
      navigate('/forgot-password', { replace: true });
    }
  }, [email, resetToken, navigate]);

  if (!email || !resetToken) {
    return <Navigate to="/forgot-password" replace />;
  }

  const formMotion = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.55, ease: AUTH_MOTION_EASE },
      };

  async function onSubmit(values) {
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      const result = await resetPassword(
        email,
        resetToken,
        values.newPassword,
        values.confirmPassword
      );
      setSuccess(result.message || t('resetPasswordNew.success'));
      sessionStorage.removeItem(storageKeys.passwordResetToken);
      removeStorageItem(storageKeys.pendingPasswordResetEmail);
      window.setTimeout(() => {
        navigate('/login/student', { replace: true });
      }, 1500);
    } catch (err) {
      setError(getApiErrorMessage(err, t('resetPasswordNew.errors.generic')));
    } finally {
      setSubmitting(false);
    }
  }

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
                <h1 className="auth-split__title">{t('resetPasswordNew.title')}</h1>
                <p className="auth-split__subtitle">{t('resetPasswordNew.subtitle')}</p>
              </header>

              {success ? (
                <div className="auth-form" role="status">
                  <p className="auth-register__helper">{success}</p>
                  <div className="auth-form__actions">
                    <Button type="button" onClick={() => navigate('/login/student', { replace: true })}>
                      {t('resetPasswordNew.goToLogin')}
                    </Button>
                  </div>
                </div>
              ) : (
                <form className="auth-form auth-form--login" onSubmit={handleSubmit(onSubmit)} noValidate>
                  {error ? <p className="auth-form__error">{error}</p> : null}

                  <FormInput
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    label={t('resetPasswordNew.newPassword')}
                    placeholder={t('login.placeholders.password')}
                    error={errors.newPassword?.message}
                    passwordToggle
                    inputClassName="auth-form__input"
                    {...register('newPassword')}
                  />

                  <FormInput
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    label={t('resetPasswordNew.confirmPassword')}
                    placeholder={t('register.placeholders.confirmPassword')}
                    error={errors.confirmPassword?.message}
                    passwordToggle
                    inputClassName="auth-form__input"
                    {...register('confirmPassword')}
                  />

                  <div className="auth-form__actions">
                    <Button type="submit" variant="primary" disabled={submitting} className="auth-form__submit">
                      {submitting ? t('resetPasswordNew.submitting') : t('resetPasswordNew.submit')}
                    </Button>
                  </div>

                  <p className="auth-form__sign-up-row">
                    <Link className="auth-form__sign-up-link" to="/login/student">
                      {t('resetPasswordNew.backToLogin')}
                    </Link>
                  </p>
                </form>
              )}
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
