import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { forgotPassword } from '../../features/auth/auth.service.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';
import { setStorageItem, storageKeys } from '../../utils/storage.js';
import loginIllustration from '../../assets/landing/illustrations/hero-student-learning.svg';

export function ForgotPasswordPage() {
  const { t, i18n } = useTranslation('auth');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const reduced = useReducedMotion();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const schema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .min(1, t('forgotPassword.errors.emailRequired'))
          .email(t('forgotPassword.errors.invalidEmail')),
      }),
    [t, i18n.language]
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

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
    const normalizedEmail = values.email.trim().toLowerCase();
    try {
      const result = await forgotPassword(normalizedEmail);
      setSuccess(result.message || t('forgotPassword.success'));
      setStorageItem(storageKeys.pendingPasswordResetEmail, normalizedEmail);
      window.setTimeout(() => {
        navigate('/reset-password/verify', { state: { email: normalizedEmail } });
      }, 1200);
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === 'OTP_RESEND_COOLDOWN') {
        setError('تم إرسال عدة طلبات خلال وقت قصير. انتظر قليلًا قبل طلب رمز جديد.');
      } else {
        setError(getApiErrorMessage(err, t('forgotPassword.errors.generic')));
      }
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
                <h1 className="auth-split__title">{t('forgotPassword.title')}</h1>
                <p className="auth-split__subtitle">{t('forgotPassword.subtitle')}</p>
              </header>

              <form className="auth-form auth-form--login" onSubmit={handleSubmit(onSubmit)} noValidate>
                {success ? <p className="auth-register__helper" role="status">{success}</p> : null}
                {error ? <p className="auth-form__error">{error}</p> : null}

                <FormInput
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  label={t('login.email')}
                  placeholder={t('login.placeholders.email')}
                  error={errors.email?.message}
                  inputClassName="auth-form__input"
                  {...register('email')}
                />

                <div className="auth-form__actions">
                  <Button type="submit" variant="primary" disabled={submitting} className="auth-form__submit">
                    {submitting ? t('forgotPassword.submitting') : t('forgotPassword.submit')}
                  </Button>
                </div>

                <p className="auth-form__sign-up-row">
                  <Link className="auth-form__sign-up-link" to="/login/student">
                    {t('forgotPassword.backToLogin')}
                  </Link>
                </p>
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
