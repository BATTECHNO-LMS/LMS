import { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  verifyPasswordResetOtp,
  resendPasswordResetOtp,
} from '../../features/auth/auth.service.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';
import { getStorageItem, setStorageItem, storageKeys } from '../../utils/storage.js';
import registerIllustration from '../../assets/landing/illustrations/journey-flow.svg';

const COOLDOWN_SECONDS = 60;

export function VerifyPasswordResetOtpPage() {
  const { t, i18n } = useTranslation('auth');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const location = useLocation();
  const reduced = useReducedMotion();

  const initialEmail = useMemo(() => {
    const fromState = location.state?.email?.trim().toLowerCase();
    if (fromState) return fromState;
    const stored = getStorageItem(storageKeys.pendingPasswordResetEmail);
    return typeof stored === 'string' ? stored : '';
  }, [location.state]);

  const [email, setEmail] = useState(initialEmail);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(COOLDOWN_SECONDS);

  const schema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .min(1, t('resetPasswordVerify.errors.emailRequired'))
          .email(t('resetPasswordVerify.errors.invalidEmail')),
        otp: z
          .string()
          .min(1, t('resetPasswordVerify.errors.otpRequired'))
          .regex(/^\d{6}$/, t('resetPasswordVerify.errors.otpInvalid')),
      }),
    [t, i18n.language]
  );

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: initialEmail, otp: '' },
  });

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
      setValue('email', initialEmail);
      setStorageItem(storageKeys.pendingPasswordResetEmail, initialEmail);
    }
  }, [initialEmail, setValue]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  if (!initialEmail && !email) {
    return <Navigate to="/forgot-password" replace />;
  }

  const formMotion = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.55, ease: AUTH_MOTION_EASE },
      };

  const onSubmit = useCallback(
    async (values) => {
      setError('');
      setSubmitting(true);
      const normalizedEmail = values.email.trim().toLowerCase();
      try {
        const result = await verifyPasswordResetOtp(normalizedEmail, values.otp.trim());
        const resetToken = result?.resetToken;
        if (!resetToken || typeof resetToken !== 'string') {
          throw new Error('Invalid verify response');
        }
        sessionStorage.setItem(storageKeys.passwordResetToken, JSON.stringify(resetToken));
        setStorageItem(storageKeys.pendingPasswordResetEmail, normalizedEmail);
        navigate('/reset-password/new', { state: { email: normalizedEmail } });
      } catch (err) {
        const code = err?.response?.data?.code;
        if (code === 'INVALID_OTP') setError('رمز التحقق غير صحيح.');
        else if (code === 'OTP_EXPIRED') setError('انتهت صلاحية رمز التحقق. اطلب رمزًا جديدًا.');
        else if (code === 'OTP_RATE_LIMITED') setError('تم تجاوز عدد المحاولات المسموح. اطلب رمزًا جديدًا.');
        else setError(getApiErrorMessage(err, t('resetPasswordVerify.errors.generic')));
      } finally {
        setSubmitting(false);
      }
    },
    [navigate, t]
  );

  async function handleResend() {
    if (cooldown > 0 || !email.trim()) return;
    setError('');
    setResending(true);
    try {
      await resendPasswordResetOtp(email.trim().toLowerCase());
      setCooldown(COOLDOWN_SECONDS);
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === 'OTP_RESEND_COOLDOWN') {
        setError('تم إرسال عدة طلبات خلال وقت قصير. انتظر قليلًا قبل طلب رمز جديد.');
      } else {
        const msg = getApiErrorMessage(err, t('resetPasswordVerify.errors.resendFailed'));
        setError(msg);
      }
      const remaining = err?.response?.data?.details?.cooldownSeconds;
      if (typeof remaining === 'number' && remaining > 0) {
        setCooldown(remaining);
      }
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="auth-page auth-page--split auth-page--register">
      <AuthBackgroundDecor />
      <div className="auth-split-wrap">
        <span className="auth-split__halo" aria-hidden />
        <div className="auth-split auth-split--register">
          <motion.section className="auth-split__form" {...formMotion}>
            <div className="auth-split__form-inner">
              <BrandLogo variant="auth" alt={tCommon('logo.alt')} className="auth-split__logo" />

              <header className="auth-split__header auth-split__header--register">
                <h1 className="auth-split__title">{t('resetPasswordVerify.title')}</h1>
                <p className="auth-split__subtitle">{t('resetPasswordVerify.subtitle')}</p>
              </header>

              <form className="auth-form auth-form--register" onSubmit={handleSubmit(onSubmit)} noValidate>
                {error ? <p className="auth-form__error">{error}</p> : null}

                <FormInput
                  id="reset-verify-email"
                  type="email"
                  autoComplete="email"
                  label={t('login.email')}
                  placeholder={t('login.placeholders.email')}
                  error={errors.email?.message}
                  inputClassName="auth-form__input"
                  readOnly
                  {...register('email', {
                    onChange: (e) => {
                      const next = e.target.value.trim().toLowerCase();
                      setEmail(next);
                      setStorageItem(storageKeys.pendingPasswordResetEmail, next);
                    },
                  })}
                />

                <FormInput
                  id="reset-verify-otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  label={t('resetPasswordVerify.otpLabel')}
                  placeholder="000000"
                  error={errors.otp?.message}
                  inputClassName="auth-form__input auth-form__input--otp"
                  {...register('otp')}
                />

                <div className="auth-form__actions auth-register__actions">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? t('resetPasswordVerify.submitting') : t('resetPasswordVerify.submit')}
                  </Button>
                </div>

                <div className="auth-form__sign-up-row auth-register__login-row">
                  <button
                    type="button"
                    className="auth-form__sign-up-link auth-register__link"
                    disabled={resending || cooldown > 0}
                    onClick={handleResend}
                  >
                    {cooldown > 0
                      ? t('resetPasswordVerify.resendCooldown', { seconds: cooldown })
                      : t('resetPasswordVerify.resend')}
                  </button>
                </div>

                <p className="auth-form__sign-up-row auth-register__login-row">
                  <Link className="auth-form__sign-up-link auth-register__link" to="/forgot-password">
                    {t('resetPasswordVerify.back')}
                  </Link>
                </p>
              </form>
            </div>
          </motion.section>

          <AuthVisualPanel
            illustration={registerIllustration}
            titleKey="register.panelTitle"
            subtitleKey="register.panelSubtitle"
          />
        </div>
      </div>
    </div>
  );
}
