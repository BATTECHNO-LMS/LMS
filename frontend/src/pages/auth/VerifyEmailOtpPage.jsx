import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
import { verifyEmailOtp, resendEmailOtp } from '../../features/auth/auth.service.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';
import { storageKeys, getStorageItem, setStorageItem, removeStorageItem } from '../../utils/storage.js';
import registerIllustration from '../../assets/landing/illustrations/journey-flow.svg';
import { mapAuthErrorToLoginMessage } from '../../utils/authErrors.js';

const COOLDOWN_SECONDS = 60;

export function VerifyEmailOtpPage() {
  const { t, i18n } = useTranslation('auth');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reduced = useReducedMotion();

  const initialEmail = useMemo(() => {
    const fromQuery = searchParams.get('email')?.trim().toLowerCase();
    if (fromQuery) return fromQuery;
    const stored = getStorageItem(storageKeys.pendingVerificationEmail);
    return typeof stored === 'string' ? stored : '';
  }, [searchParams]);

  const [email, setEmail] = useState(initialEmail);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cooldown, setCooldown] = useState(COOLDOWN_SECONDS);

  const schema = useMemo(
    () =>
      z.object({
        email: z.string().min(1, t('verifyEmail.errors.emailRequired')).email(t('verifyEmail.errors.invalidEmail')),
        otp: z
          .string()
          .min(1, t('verifyEmail.errors.otpRequired'))
          .regex(/^\d{6}$/, t('verifyEmail.errors.otpInvalid')),
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
      setStorageItem(storageKeys.pendingVerificationEmail, initialEmail);
    }
  }, [initialEmail, setValue]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

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
      setSuccess('');
      setSubmitting(true);
      const normalizedEmail = values.email.trim().toLowerCase();
      try {
        const result = await verifyEmailOtp(normalizedEmail, values.otp.trim());
        const isInstitutionPortal = searchParams.get('portal') === 'institutions';
        if (isInstitutionPortal || result?.requiresAdminApproval) {
          setSuccess(
            isInstitutionPortal
              ? 'INSTITUTION_PENDING'
              : 'تم توثيق بريدك الإلكتروني. حسابك بانتظار التفعيل.'
          );
        } else {
          setSuccess(t('verifyEmail.successCanLogin'));
        }
        removeStorageItem(storageKeys.pendingVerificationEmail);
      } catch (err) {
        const code = err?.response?.data?.code;
        if (code === 'INVALID_OTP') setError(t('verifyEmail.errors.invalidOtp'));
        else if (code === 'OTP_EXPIRED') setError(t('verifyEmail.errors.otpExpired'));
        else if (code === 'OTP_RATE_LIMITED') setError(t('verifyEmail.errors.rateLimited'));
        else setError(getApiErrorMessage(err, t('verifyEmail.errors.generic')));
      } finally {
        setSubmitting(false);
      }
    },
    [t, searchParams]
  );

  async function handleResend() {
    if (cooldown > 0 || !email.trim()) return;
    setError('');
    setResending(true);
    try {
      await resendEmailOtp(email.trim().toLowerCase());
      setCooldown(COOLDOWN_SECONDS);
      setSuccess(t('verifyEmail.resendSuccess'));
    } catch (err) {
      const mapped = mapAuthErrorToLoginMessage(
        getApiErrorMessage(err, t('verifyEmail.errors.resendFailed')),
        t,
        err
      );
      setError(mapped || t('verifyEmail.errors.resendFailed'));
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
                <h1 className="auth-split__title">{t('verifyEmail.title')}</h1>
                <p className="auth-split__subtitle">{t('verifyEmail.subtitle')}</p>
              </header>

              {success ? (
                <div className="auth-form" role="status">
                  {success === 'INSTITUTION_PENDING' ? (
                    <>
                      <h2 className="auth-split__title" style={{ fontSize: '1.35rem' }}>
                        تم توثيق بريدك الإلكتروني
                      </h2>
                      <p className="auth-split__subtitle">حسابك بانتظار التفعيل</p>
                      <p className="auth-register__helper">
                        تم توثيق بياناتك بنجاح، وحسابك الآن بانتظار مراجعة وتفعيل مسؤول المؤسسة.
                        سيتم تفعيل الحساب خلال مدة لا تتجاوز 48 ساعة.
                      </p>
                    </>
                  ) : (
                    <p className="auth-register__helper">{success}</p>
                  )}
                  <div className="auth-form__actions">
                    <Button
                      type="button"
                      onClick={() =>
                        navigate(
                          success === 'INSTITUTION_PENDING'
                            ? '/account-status'
                            : searchParams.get('portal') === 'institutions'
                              ? '/institutions/login'
                              : '/universities/login',
                          { replace: true }
                        )
                      }
                    >
                      {success === 'INSTITUTION_PENDING'
                        ? 'حالة حسابك'
                        : t('verifyEmail.goToLogin')}
                    </Button>
                  </div>
                </div>
              ) : (
                <form className="auth-form auth-form--register" onSubmit={handleSubmit(onSubmit)} noValidate>
                  {error ? <p className="auth-form__error">{error}</p> : null}

                  <p className="auth-register__helper">{t('verifyEmail.sentNotice')}</p>

                  <FormInput
                    id="verify-email"
                    type="email"
                    autoComplete="email"
                    label={t('login.email')}
                    placeholder={t('login.placeholders.email')}
                    error={errors.email?.message}
                    inputClassName="auth-form__input"
                    {...register('email', {
                      onChange: (e) => {
                        const next = e.target.value.trim().toLowerCase();
                        setEmail(next);
                        setStorageItem(storageKeys.pendingVerificationEmail, next);
                      },
                    })}
                  />

                  <FormInput
                    id="verify-otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    label={t('verifyEmail.otpLabel')}
                    placeholder="000000"
                    error={errors.otp?.message}
                    inputClassName="auth-form__input auth-form__input--otp"
                    {...register('otp')}
                  />

                  <div className="auth-form__actions auth-register__actions">
                    <Button type="submit" disabled={submitting}>
                      {submitting ? t('verifyEmail.submitting') : t('verifyEmail.submit')}
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
                        ? t('verifyEmail.resendCooldown', { seconds: cooldown })
                        : t('verifyEmail.resend')}
                    </button>
                  </div>

                  <p className="auth-form__sign-up-row auth-register__login-row">
                    <Link className="auth-form__sign-up-link auth-register__link" to="/login/student">
                      {t('register.loginLink')}
                    </Link>
                  </p>
                </form>
              )}
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
