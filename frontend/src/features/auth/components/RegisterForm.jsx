import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { FormInput } from '../../../components/forms/FormInput.jsx';
import { createRegisterStudentSchema } from '../validation/registerStudentSchema.js';
import { UniversitySelect } from './UniversitySelect.jsx';
import { SpecialtySelect } from './SpecialtySelect.jsx';
import { SubmitButton } from './SubmitButton.jsx';
import { fetchRegisterUniversitiesCatalog } from '../auth.service.js';
import { mapUniversitiesForSelect } from '../../../constants/universities.js';
import { useUniversitySpecialties, getUniversitySpecialtyLabel } from '../../specialties/index.js';
import { useAuth } from '../hooks/useAuth.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { storageKeys, setStorageItem } from '../../../utils/storage.js';
import { AUTH_MOTION_EASE } from '../../../pages/auth/authMotion.js';
import { AccountStatusModal } from '../../../pages/auth/AccountStatusModal.jsx';

export function RegisterForm() {
  const { t, i18n } = useTranslation('auth');
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const reduced = useReducedMotion();
  const [formError, setFormError] = useState('');
  const [successModal, setSuccessModal] = useState({
    open: false,
    title: '',
    message: '',
    note: '',
    redirectTo: '/login/student',
  });

  const schema = useMemo(() => createRegisterStudentSchema(t), [t, i18n.language]);

  const {
    data: universityRows = [],
    isLoading: universitiesLoading,
    isError: universitiesError,
    error: universitiesErr,
  } = useQuery({
    queryKey: ['auth', 'registerUniversities'],
    queryFn: fetchRegisterUniversitiesCatalog,
    staleTime: 5 * 60 * 1000,
  });

  const universityOptions = useMemo(
    () => mapUniversitiesForSelect(universityRows, { locale: i18n.language }),
    [universityRows, i18n.language]
  );

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: '',
      email: '',
      password: '',
      confirm_password: '',
      university: '',
      specialty: '',
      phone: '',
    },
  });

  const selectedUniversityId = watch('university');

  const {
    data: specialtyRows = [],
    isLoading: specialtiesLoading,
    isError: specialtiesError,
    error: specialtiesErr,
  } = useUniversitySpecialties(selectedUniversityId || null);

  const specialtyOptions = useMemo(
    () =>
      specialtyRows.map((row) => ({
        id: row.id,
        label: getUniversitySpecialtyLabel(row, i18n.language),
      })),
    [specialtyRows, i18n.language]
  );

  const fieldMotion = (delay) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.4, delay, ease: AUTH_MOTION_EASE },
        };

  function handleUniversityChange(fieldOnChange, event) {
    fieldOnChange(event);
    setValue('specialty', '', { shouldValidate: false, shouldDirty: true });
  }

  async function onSubmit(data) {
    setFormError('');
    const payload = {
      full_name: data.full_name.trim(),
      email: data.email.trim().toLowerCase(),
      password: data.password,
      university_id: data.university,
      university_specialty_id: data.specialty,
      phone: data.phone?.trim() || undefined,
    };

    try {
      const result = await signUp(payload);
      if (result?.requiresEmailVerification) {
        const email = result.email || payload.email;
        setStorageItem(storageKeys.pendingVerificationEmail, email);
        setSuccessModal({
          open: true,
          title: 'تم إنشاء حسابك بنجاح',
          message:
            'أرسلنا رمز تحقق إلى بريدك الإلكتروني. بعد توثيق البريد سيبقى الحساب بانتظار تفعيل الإدارة، ويتم التفعيل عادةً خلال 48 ساعة.',
          note: 'تأكد من توثيق بريدك الإلكتروني ومراجعة البريد الوارد والرسائل غير المرغوب فيها.',
          redirectTo: `/verify-email?email=${encodeURIComponent(email)}`,
        });
        return;
      }
      if (result?.pendingApproval) {
        setSuccessModal({
          open: true,
          title: 'حسابك بانتظار التفعيل',
          message:
            'تم توثيق بريدك بنجاح، وحسابك الآن بانتظار تفعيل الإدارة خلال 48 ساعة.',
          note: 'يمكنك العودة لاحقًا لتسجيل الدخول بعد اكتمال التفعيل.',
          redirectTo: '/login/student?registered=pending',
        });
        return;
      }
      if (result?.redirectTo) {
        navigate(result.redirectTo, { replace: true });
      }
    } catch (err) {
      const code = err?.response?.data?.code;
      const fields = err?.response?.data?.details?.fields || null;
      if (fields && typeof fields === 'object') {
        Object.entries(fields).forEach(([key, msgs]) => {
          if (Array.isArray(msgs) && msgs[0]) {
            setError(key, { type: 'server', message: msgs[0] });
          }
        });
      }
      if (code === 'EMAIL_ALREADY_EXISTS') {
        setFormError('البريد الإلكتروني مستخدم مسبقًا. يمكنك تسجيل الدخول أو استعادة كلمة المرور.');
      } else if (code === 'PHONE_ALREADY_EXISTS') {
        setFormError('رقم الهاتف مستخدم مسبقًا. تحقق من الرقم أو تواصل مع الدعم.');
      } else {
        setFormError(getApiErrorMessage(err, t('register.submitFailed')));
      }
    }
  }

  return (
    <>
      <AccountStatusModal
        open={successModal.open}
        title={successModal.title}
        message={successModal.message}
        note={successModal.note}
        variant="success"
        onClose={() => setSuccessModal((s) => ({ ...s, open: false }))}
        actions={[
          {
            key: 'ok',
            label: 'حسنًا',
            onClick: () => {
              setSuccessModal((s) => ({ ...s, open: false }));
              navigate(successModal.redirectTo || '/login/student', { replace: true });
            },
          },
        ]}
      />
    <form className="auth-form auth-form--register" onSubmit={handleSubmit(onSubmit)} noValidate>
      {formError ? <p className="auth-form__error">{formError}</p> : null}

      <div className="auth-form__fields-grid">
        <motion.div {...fieldMotion(0.08)}>
          <FormInput
            id="register-full-name"
            autoComplete="name"
            label={t('register.labels.fullName')}
            placeholder={t('register.placeholders.fullName')}
            error={errors.full_name?.message}
            inputClassName="auth-form__input"
            {...register('full_name')}
          />
        </motion.div>

        <motion.div {...fieldMotion(0.12)} className="auth-register__field-block">
          <FormInput
            id="register-email"
            type="email"
            autoComplete="email"
            label={t('register.labels.email')}
            placeholder={t('register.placeholders.email')}
            error={errors.email?.message}
            inputClassName="auth-form__input"
            {...register('email')}
            aria-describedby="register-email-helper"
          />
          <p id="register-email-helper" className="auth-register__helper">
            {t('register.emailHelper')}
          </p>
        </motion.div>

        <motion.div {...fieldMotion(0.16)}>
          <Controller
            name="university"
            control={control}
            render={({ field }) => (
              <UniversitySelect
                id="register-university"
                label={t('register.labels.university')}
                error={errors.university?.message}
                disabled={isSubmitting}
                options={universityOptions}
                loading={universitiesLoading}
                controlClassName="auth-form__input"
                {...field}
                onChange={(event) => handleUniversityChange(field.onChange, event)}
              />
            )}
          />
        </motion.div>

        <motion.div {...fieldMotion(0.18)}>
          <Controller
            name="specialty"
            control={control}
            render={({ field }) => (
              <SpecialtySelect
                id="register-specialty"
                label={t('register.labels.specialty')}
                error={errors.specialty?.message}
                disabled={isSubmitting || !selectedUniversityId}
                options={specialtyOptions}
                loading={Boolean(selectedUniversityId) && specialtiesLoading}
                placeholder={
                  selectedUniversityId
                    ? t('register.specialtyPlaceholder')
                    : t('register.specialtySelectUniversityFirst')
                }
                emptyLabel={t('register.specialtiesEmpty')}
                controlClassName="auth-form__input"
                {...field}
              />
            )}
          />
        </motion.div>

        <motion.div {...fieldMotion(0.2)}>
          <FormInput
            id="register-phone"
            type="tel"
            autoComplete="tel"
            label={t('register.labels.phone')}
            placeholder={t('register.placeholders.phone')}
            error={errors.phone?.message}
            inputClassName="auth-form__input"
            {...register('phone')}
          />
        </motion.div>

        <motion.div {...fieldMotion(0.24)}>
          <FormInput
            id="register-password"
            type="password"
            autoComplete="new-password"
            label={t('register.labels.password')}
            placeholder={t('register.placeholders.password')}
            error={errors.password?.message}
            passwordToggle
            inputClassName="auth-form__input"
            {...register('password')}
          />
        </motion.div>

        <motion.div {...fieldMotion(0.28)}>
          <FormInput
            id="register-confirm-password"
            type="password"
            autoComplete="new-password"
            label={t('register.labels.confirmPassword')}
            placeholder={t('register.placeholders.confirmPassword')}
            error={errors.confirm_password?.message}
            passwordToggle
            inputClassName="auth-form__input"
            {...register('confirm_password')}
          />
        </motion.div>
      </div>

      {universitiesError ? (
        <p className="auth-form__error auth-form__span-full" role="alert">
          {getApiErrorMessage(universitiesErr, t('register.submitFailed'))}
        </p>
      ) : null}

      {selectedUniversityId && specialtiesError ? (
        <p className="auth-form__error auth-form__span-full" role="alert">
          {getApiErrorMessage(specialtiesErr, t('register.submitFailed'))}
        </p>
      ) : null}

      {!universitiesLoading && !universitiesError && universityOptions.length === 0 ? (
        <p className="auth-register__helper auth-form__span-full" role="status">
          {t('register.universitiesEmpty')}
        </p>
      ) : null}

      <motion.div {...fieldMotion(0.32)} className="auth-form__actions auth-register__actions">
        <SubmitButton loading={isSubmitting}>{t('register.submit')}</SubmitButton>
      </motion.div>

      <motion.p {...fieldMotion(0.36)} className="auth-form__sign-up-row auth-register__login-row">
        <span>{t('register.loginPrompt')}</span>{' '}
        <Link className="auth-form__sign-up-link auth-register__link" to="/login">
          {t('register.loginLink')}
        </Link>
      </motion.p>
    </form>
    </>
  );
}
