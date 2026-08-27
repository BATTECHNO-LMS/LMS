import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, useReducedMotion } from 'framer-motion';
import { FormInput } from '../../components/forms/FormInput.jsx';
import { FormSelect } from '../../components/forms/FormSelect.jsx';
import { BrandLogo } from '../../components/common/BrandLogo.jsx';
import { useAuth } from '../../features/auth/index.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';
import {
  listPublicInstitutionBranches,
  listPublicInstitutions,
  registerInstitutionUser,
} from '../../features/organizations/organizations.service.js';
import { resolveAuthenticatedPublicPageRedirect } from '../../utils/resolveAuthenticatedLandingRoute.js';
import { PORTAL_ENTRIES, PORTAL_SELECTION_PATH } from '../../constants/portalConfig.js';
import { AuthBackgroundDecor } from './AuthBackgroundDecor.jsx';
import { AuthVisualPanel } from './AuthVisualPanel.jsx';
import { AUTH_MOTION_EASE } from './authMotion.js';
import { SubmitButton } from '../../features/auth/components/SubmitButton.jsx';
import registerIllustration from '../../assets/landing/illustrations/journey-flow.svg';

const schema = z
  .object({
    full_name: z.string().trim().min(1, 'يرجى إدخال الاسم الكامل.'),
    phone: z.string().trim().min(1, 'يرجى إدخال رقم الهاتف.'),
    organization_id: z.string().uuid('يرجى اختيار المؤسسة.'),
    branch_id: z.string().uuid('يرجى اختيار الفرع.'),
    email: z
      .string()
      .trim()
      .min(1, 'البريد الإلكتروني مطلوب.')
      .email('يرجى إدخال بريد إلكتروني صحيح.'),
    password: z.string().min(8, 'كلمة المرور يجب أن تحتوي على 8 أحرف على الأقل.'),
    confirm_password: z.string().min(1, 'يرجى تأكيد كلمة المرور.'),
  })
  .refine((v) => v.password === v.confirm_password, {
    message: 'كلمتا المرور غير متطابقتين.',
    path: ['confirm_password'],
  });

export function InstitutionRegisterPage() {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const { isAuthenticated, user } = useAuth();
  const [institutions, setInstitutions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: '',
      phone: '',
      organization_id: '',
      branch_id: '',
      email: '',
      password: '',
      confirm_password: '',
    },
  });

  const organizationId = watch('organization_id');

  useEffect(() => {
    setCatalogLoading(true);
    listPublicInstitutions()
      .then((data) => setInstitutions(Array.isArray(data) ? data : []))
      .catch(() => setInstitutions([]))
      .finally(() => setCatalogLoading(false));
  }, []);

  useEffect(() => {
    setValue('branch_id', '');
    if (!organizationId) {
      setBranches([]);
      return;
    }
    setBranchesLoading(true);
    listPublicInstitutionBranches(organizationId)
      .then((data) => setBranches(Array.isArray(data) ? data : []))
      .catch(() => setBranches([]))
      .finally(() => setBranchesLoading(false));
  }, [organizationId, setValue]);

  const formMotion = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.55, ease: AUTH_MOTION_EASE },
      };

  const institutionOptions = useMemo(
    () =>
      institutions.map((item) => ({
        id: String(item.id),
        name: String(item.name || 'مؤسسة'),
      })),
    [institutions]
  );

  if (isAuthenticated && user) {
    const dest = resolveAuthenticatedPublicPageRedirect(user);
    return <Navigate to={dest.path} replace />;
  }

  async function onSubmit(values) {
    setFormError('');
    try {
      await registerInstitutionUser({
        full_name: values.full_name.trim(),
        phone: values.phone.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
        organization_id: values.organization_id,
        branch_id: values.branch_id,
      });
      navigate(
        `/verify-email?email=${encodeURIComponent(values.email.trim().toLowerCase())}&portal=institutions`,
        { replace: true }
      );
    } catch (err) {
      setFormError(
        getApiErrorMessage(err, err?.response?.data?.message || 'تعذر إكمال التسجيل. حاول مرة أخرى.')
      );
    }
  }

  return (
    <div className="auth-page auth-page--split auth-page--register" dir="rtl">
      <AuthBackgroundDecor />
      <div className="auth-split-wrap">
        <span className="auth-split__halo" aria-hidden />
        <div className="auth-split auth-split--register">
          <motion.section className="auth-split__form" {...formMotion}>
            <div className="auth-split__form-inner auth-split__form-inner--wide">
              <BrandLogo variant="auth" alt="BATTECHNO LMS" className="auth-split__logo" />

              <header className="auth-split__header auth-split__header--register">
                <p className="auth-form__portal-label">
                  <span className="portal-badge">{PORTAL_ENTRIES.INSTITUTION.titleAr}</span>
                </p>
                <h1 className="auth-split__title">إنشاء حساب متدرب</h1>
                <p className="auth-split__subtitle">
                  أنشئ حسابك للانضمام إلى الدورات التدريبية التابعة لمؤسستك.
                </p>
              </header>

              <form
                className="auth-form auth-form--register"
                onSubmit={handleSubmit(onSubmit)}
                noValidate
              >
                {formError ? (
                  <p className="auth-form__error auth-form__span-full" role="alert">
                    {formError}
                  </p>
                ) : null}

                <section className="auth-form__section" aria-labelledby="inst-reg-personal">
                  <h2 id="inst-reg-personal" className="auth-form__section-title">
                    البيانات الشخصية
                  </h2>
                  <div className="auth-form__fields-grid">
                    <FormInput
                      id="inst-full-name"
                      label="الاسم الكامل"
                      autoComplete="name"
                      error={errors.full_name?.message}
                      inputClassName="auth-form__input"
                      {...register('full_name')}
                    />
                    <FormInput
                      id="inst-phone"
                      type="tel"
                      label="رقم الهاتف"
                      autoComplete="tel"
                      dir="ltr"
                      error={errors.phone?.message}
                      inputClassName="auth-form__input"
                      {...register('phone')}
                    />
                  </div>
                </section>

                <section className="auth-form__section" aria-labelledby="inst-reg-org">
                  <h2 id="inst-reg-org" className="auth-form__section-title">
                    بيانات المؤسسة
                  </h2>
                  <div className="auth-form__fields-grid">
                    <FormSelect
                      id="inst-organization"
                      label="المؤسسة"
                      selectClassName="auth-form__input"
                      error={errors.organization_id?.message}
                      disabled={catalogLoading || isSubmitting}
                      {...register('organization_id')}
                    >
                      <option value="">
                        {catalogLoading ? 'جاري تحميل المؤسسات...' : 'اختر المؤسسة'}
                      </option>
                      {institutionOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </FormSelect>
                    <FormSelect
                      id="inst-branch"
                      label="الفرع"
                      selectClassName="auth-form__input"
                      error={errors.branch_id?.message}
                      disabled={!organizationId || branchesLoading || isSubmitting}
                      {...register('branch_id')}
                    >
                      <option value="">
                        {!organizationId
                          ? 'اختر المؤسسة أولًا'
                          : branchesLoading
                            ? 'جاري تحميل الفروع...'
                            : branches.length
                              ? 'اختر الفرع'
                              : 'لا توجد فروع نشطة'}
                      </option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </FormSelect>
                  </div>
                </section>

                <section className="auth-form__section" aria-labelledby="inst-reg-login">
                  <h2 id="inst-reg-login" className="auth-form__section-title">
                    بيانات الدخول
                  </h2>
                  <div className="auth-form__fields-grid">
                    <FormInput
                      id="inst-email"
                      type="email"
                      label="البريد الإلكتروني"
                      autoComplete="email"
                      dir="ltr"
                      className="auth-form__span-full"
                      error={errors.email?.message}
                      inputClassName="auth-form__input"
                      {...register('email')}
                    />
                    <FormInput
                      id="inst-password"
                      type="password"
                      label="كلمة المرور"
                      autoComplete="new-password"
                      passwordToggle
                      error={errors.password?.message}
                      inputClassName="auth-form__input"
                      {...register('password')}
                    />
                    <FormInput
                      id="inst-confirm-password"
                      type="password"
                      label="تأكيد كلمة المرور"
                      autoComplete="new-password"
                      passwordToggle
                      error={errors.confirm_password?.message}
                      inputClassName="auth-form__input"
                      {...register('confirm_password')}
                    />
                  </div>
                </section>

                <div className="auth-form__actions auth-register__actions">
                  <SubmitButton loading={isSubmitting}>إنشاء الحساب</SubmitButton>
                </div>

                <p className="auth-form__sign-up-row auth-register__login-row">
                  <span>لديك حساب؟</span>{' '}
                  <Link className="auth-form__sign-up-link" to="/institutions/login">
                    تسجيل الدخول
                  </Link>
                </p>
                <p className="auth-form__sign-up-row">
                  <Link className="auth-form__sign-up-link" to={PORTAL_SELECTION_PATH}>
                    العودة إلى اختيار البوابة
                  </Link>
                </p>
              </form>
            </div>
          </motion.section>

          <AuthVisualPanel
            illustration={registerIllustration}
            title="بوابة المؤسسات"
            subtitle="انضم إلى دورات مؤسستك، تابع الجلسات والحضور والمهمات، واحصل على شهاداتك بعد إتمام المتطلبات."
            benefits={[
              'دورات تدريبية منظمة حسب المؤسسة',
              'متابعة الحضور والجلسات',
              'مهمات واختبارات وتقدم واضح',
              'تفعيل الحساب خلال 48 ساعة بعد التوثيق',
            ]}
          />
        </div>
      </div>
    </div>
  );
}
