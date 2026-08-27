import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import { FormInput } from '../../components/forms/FormInput.jsx';
import { Button } from '../../components/common/Button.jsx';
import { useAuth } from '../../features/auth/index.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';
import { mapAuthErrorToLoginMessage } from '../../utils/authErrors.js';
import { ROLES } from '../../constants/roles.js';
import { BrandLogo } from '../../components/common/BrandLogo.jsx';
import { AuthVisualPanel } from './AuthVisualPanel.jsx';
import { AuthBackgroundDecor } from './AuthBackgroundDecor.jsx';
import { AUTH_MOTION_EASE } from './authMotion.js';
import { AccountStatusModal } from './AccountStatusModal.jsx';
import { resendEmailOtp } from '../../features/auth/auth.service.js';
import universityLoginIllustration from '../../assets/landing/illustrations/hero-student-learning.svg';
import institutionLoginIllustration from '../../assets/landing/illustrations/institution-training-login.svg';
import { PORTAL_ENTRIES, PORTAL_SELECTION_PATH, PORTAL_TYPES } from '../../constants/portalConfig.js';
import { resolveAuthenticatedLandingRoute } from '../../utils/resolveAuthenticatedLandingRoute.js';
import { rememberSelectedPortal } from '../../utils/portal.js';

const EASE = AUTH_MOTION_EASE;

/**
 * Shared login UI. Portal-specific pages pass `portalType` for labels + non-authoritative hint.
 * Role-forced portal logins (legacy subdomain) still pass `forcedRole`.
 */
export function LoginPage({
  forcedRole = null,
  forcedRoleLabelAr = '',
  forcedRoleLabelEn = '',
  portalType = null,
}) {
  const { t, i18n } = useTranslation('auth');
  const { t: tCommon } = useTranslation('common');
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const from = location.state?.from?.pathname;
  const returnTo =
    typeof location.state?.returnTo === 'string' && location.state.returnTo.startsWith('/')
      ? location.state.returnTo
      : null;
  const postLoginTarget =
    returnTo || (from && from !== '/login' && !from.startsWith('/login/') ? from : null);
  const registrationPendingNotice = searchParams.get('registered') === 'pending';
  const reduced = useReducedMotion();

  const portalEntry =
    portalType === PORTAL_TYPES.INSTITUTION
      ? PORTAL_ENTRIES.INSTITUTION
      : portalType === PORTAL_TYPES.UNIVERSITY
        ? PORTAL_ENTRIES.UNIVERSITY
        : null;

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [mismatchNotice, setMismatchNotice] = useState(null);
  const [statusModal, setStatusModal] = useState({
    open: false,
    title: '',
    message: '',
    note: '',
    variant: 'pending',
    details: null,
    code: '',
    systemKey: null,
  });

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

  if (isAuthenticated && user && !mismatchNotice) {
    const resolution = resolveAuthenticatedLandingRoute(user, {
      selectedPortal: portalType,
      preferredReturnTo: postLoginTarget,
    });
    return <Navigate to={resolution.path} replace />;
  }

  async function onSubmit(values) {
    setServerError('');
    setMismatchNotice(null);
    setSubmitting(true);
    try {
      if (portalType) rememberSelectedPortal(portalType);
      const { redirectTo } = await login({
        email: values.email.trim(),
        password: values.password,
        portalType: portalType || undefined,
        preferredReturnTo: postLoginTarget,
      });

      navigate(redirectTo, { replace: true });
    } catch (err) {
      const code = err?.response?.data?.code;
      const details = err?.response?.data?.details || null;
      if (code === 'PORTAL_MISMATCH') {
        const loginPath =
          details?.loginPath ||
          (portalType === PORTAL_TYPES.INSTITUTION
            ? '/universities/login'
            : '/institutions/login');
        const actionLabel =
          details?.actionLabelAr ||
          (loginPath.includes('universities')
            ? 'الانتقال إلى بوابة الجامعات'
            : 'الانتقال إلى بوابة المؤسسات');
        setMismatchNotice({
          message: err?.response?.data?.message || t('login.errors.portalMismatch'),
          path: loginPath,
          actionLabel,
        });
        setServerError('');
      } else if (code === 'ACCOUNT_PENDING_ACTIVATION' || code === 'EMAIL_NOT_VERIFIED') {
        const overdue = Boolean(details?.overdue48h);
        setStatusModal({
          open: true,
          code,
          details,
          systemKey: overdue ? 'ACCOUNT_ACTIVATION_OVERDUE' : 'ACCOUNT_PENDING_ACTIVATION',
          variant: overdue ? 'warning' : 'pending',
          title: overdue ? 'تأخر تفعيل حسابك' : 'حسابك لم يُفعّل بعد',
          message:
            code === 'EMAIL_NOT_VERIFIED'
              ? 'يرجى توثيق بريدك الإلكتروني قبل متابعة الدخول.'
              : overdue
                ? 'مرّت أكثر من 48 ساعة على طلب التفعيل. يمكنك التواصل مع فريق الدعم لمراجعة حالة حسابك.'
                : 'حسابك موثق وبانتظار تفعيل الإدارة.',
          note: 'تأكد من توثيق بريدك الإلكتروني ومراجعة البريد الوارد والرسائل غير المرغوب فيها.',
        });
        setServerError('');
      } else if (code === 'ACCOUNT_DISABLED' || code === 'ACCOUNT_REJECTED') {
        setStatusModal({
          open: true,
          code,
          details,
          systemKey: null,
          variant: 'error',
          title: code === 'ACCOUNT_REJECTED' ? 'تعذر تفعيل الحساب' : 'الحساب معطل مؤقتًا',
          message:
            code === 'ACCOUNT_REJECTED'
              ? 'لم تتم الموافقة على الحساب. راجع بياناتك أو تواصل مع الدعم لمعرفة السبب.'
              : 'لا يمكنك تسجيل الدخول حاليًا. تواصل مع الدعم لمعرفة حالة الحساب.',
          note: '',
        });
        setServerError('');
      } else {
        if (!err?.response) {
          setServerError(t('login.errors.network'));
        } else {
          const raw = getApiErrorMessage(err, t('login.errors.generic'));
          setServerError(mapAuthErrorToLoginMessage(raw, t, err));
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  const portalLabel = i18n.language?.startsWith('ar') ? forcedRoleLabelAr : forcedRoleLabelEn;
  const showStudentSignUp =
    portalType === PORTAL_TYPES.UNIVERSITY ||
    (!portalType && (!forcedRole || forcedRole === ROLES.STUDENT));
  const showInstitutionSignUp = portalType === PORTAL_TYPES.INSTITUTION;

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

  const badgeLabel = portalEntry
    ? portalEntry.titleAr
    : forcedRole
      ? portalLabel
      : null;

  const subtitle = portalEntry
    ? portalEntry.loginSubtitleAr || portalEntry.descriptionAr
    : t('login.welcomeSubtitle');

  const isInstitutionPortal = portalType === PORTAL_TYPES.INSTITUTION;
  const panelIllustration = isInstitutionPortal
    ? institutionLoginIllustration
    : universityLoginIllustration;
  const panelTitle = isInstitutionPortal
    ? portalEntry.loginPanelTitleAr
    : undefined;
  const panelSubtitle = isInstitutionPortal
    ? portalEntry.loginPanelSubtitleAr
    : undefined;
  const panelAlt = isInstitutionPortal
    ? portalEntry.loginIllustrationAltAr
    : '';
  const panelFeatures = isInstitutionPortal
    ? portalEntry.loginFeatureIndicatorsAr
    : undefined;

  return (
    <div
      className={`auth-page auth-page--split auth-page--login${
        isInstitutionPortal ? ' auth-page--institution' : ''
      }`}
    >
      <AccountStatusModal
        open={statusModal.open}
        title={statusModal.title}
        message={statusModal.message}
        systemKey={statusModal.systemKey || null}
        note={`${statusModal.details?.maskedEmail ? `البريد: ${statusModal.details.maskedEmail}\n` : ''}${
          statusModal.details?.emailVerified ? 'حالة البريد: موثق' : 'حالة البريد: غير موثق'
        }`}
        variant={statusModal.variant}
        onClose={() => setStatusModal((s) => ({ ...s, open: false }))}
        actions={[
          {
            key: 'ok',
            label: 'حسنًا',
            variant: 'outline',
            onClick: () => setStatusModal((s) => ({ ...s, open: false })),
          },
          {
            key: 'resend',
            label: 'إعادة إرسال رمز التحقق',
            hidden: !statusModal.details || statusModal.details.emailVerified,
            onClick: async () => {
              const rawEmail = (document.getElementById('email')?.value || '').trim().toLowerCase();
              if (!rawEmail) return;
              try {
                await resendEmailOtp(rawEmail);
                setServerError('تم إرسال رمز تحقق جديد إلى بريدك الإلكتروني.');
              } catch {
                setServerError('تم إرسال عدة طلبات خلال وقت قصير. انتظر قليلًا ثم أعد المحاولة.');
              }
            },
          },
          {
            key: 'why',
            label: 'لماذا يحتاج الحساب إلى التفعيل؟',
            variant: 'outline',
            onClick: () => navigate('/student/user-guide/articles/account-inactive'),
          },
          {
            key: 'status-page',
            label: 'حالة حسابك',
            variant: 'outline',
            onClick: () =>
              navigate('/account-status', {
                state: { details: statusModal.details },
              }),
          },
          {
            key: 'support',
            label: 'التواصل مع الدعم',
            hidden: !statusModal.details?.overdue48h,
            onClick: () => navigate('/student/user-guide/support'),
          },
        ]}
      />
      <AuthBackgroundDecor variant={isInstitutionPortal ? 'institution' : 'default'} />

      <div className="auth-split-wrap">
        <span className="auth-split__halo" aria-hidden />
        <div className={`auth-split${isInstitutionPortal ? ' auth-split--institution' : ''}`}>
          <motion.section className="auth-split__form" {...formMotion}>
            <div className="auth-split__form-inner">
              <BrandLogo variant="auth" alt={tCommon('logo.alt')} className="auth-split__logo" />

              <header className="auth-split__header">
                {badgeLabel ? (
                  <p className="auth-form__portal-label" style={{ marginBottom: '0.5rem' }}>
                    <span className="portal-badge">{badgeLabel}</span>
                  </p>
                ) : null}
                <h1 className="auth-split__title">
                  {portalEntry ? portalEntry.titleAr : t('login.welcomeTitle')}
                </h1>
                <p className="auth-split__subtitle">{subtitle}</p>
              </header>

              <form className="auth-form auth-form--login" onSubmit={handleSubmit(onSubmit)} noValidate>
                {registrationPendingNotice ? (
                  <p className="auth-register__helper" role="status">
                    {t('register.pendingApproval')}
                  </p>
                ) : null}

                {mismatchNotice ? (
                  <div className="auth-form__error" role="alert">
                    <p>{mismatchNotice.message}</p>
                    <p style={{ marginTop: '0.75rem' }}>
                      <Link className="auth-form__sign-up-link" to={mismatchNotice.path}>
                        {mismatchNotice.actionLabel}
                      </Link>
                    </p>
                  </div>
                ) : null}

                {forcedRole && !portalEntry ? (
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

                <motion.div {...fieldMotion(0.1)}>
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

                <motion.div {...fieldMotion(0.14)}>
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

                <motion.p {...fieldMotion(0.16)} className="auth-form__sign-up-row auth-form__forgot-row">
                  <Link className="auth-form__sign-up-link" to="/forgot-password">
                    {t('login.forgot')}
                  </Link>
                </motion.p>

                {serverError ? <p className="auth-form__error">{serverError}</p> : null}

                <motion.div {...fieldMotion(0.18)} className="auth-form__actions">
                  <Button type="submit" variant="primary" disabled={submitting} className="auth-form__submit">
                    {submitting ? t('login.submitting') : t('login.submit')}
                  </Button>
                </motion.div>

                {showStudentSignUp ? (
                  <motion.p {...fieldMotion(0.22)} className="auth-form__sign-up-row">
                    <span>{t('login.signUpPrompt')}</span>{' '}
                    <Link className="auth-form__sign-up-link" to="/register">
                      إنشاء حساب طالب
                    </Link>
                  </motion.p>
                ) : null}

                {showInstitutionSignUp ? (
                  <motion.p {...fieldMotion(0.22)} className="auth-form__sign-up-row">
                    <span>{portalEntry?.registerCtaPromptAr || 'متدرب جديد؟'}</span>{' '}
                    <Link className="auth-form__sign-up-link" to="/institutions/register">
                      {portalEntry?.registerCtaLinkAr || 'إنشاء حساب متدرب'}
                    </Link>
                  </motion.p>
                ) : null}

                <motion.p {...fieldMotion(0.26)} className="auth-form__sign-up-row">
                  <Link className="auth-form__sign-up-link" to={PORTAL_SELECTION_PATH}>
                    العودة إلى اختيار البوابة
                  </Link>
                </motion.p>
              </form>
            </div>
          </motion.section>

          <AuthVisualPanel
            illustration={panelIllustration}
            title={panelTitle}
            subtitle={panelSubtitle}
            titleKey={isInstitutionPortal ? undefined : 'login.panelTitle'}
            subtitleKey={isInstitutionPortal ? undefined : 'login.panelSubtitle'}
            illustrationAlt={panelAlt}
            featureIndicators={panelFeatures}
          />
        </div>
      </div>
    </div>
  );
}
