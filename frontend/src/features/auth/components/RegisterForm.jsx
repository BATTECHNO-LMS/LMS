import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { FormInput } from '../../../components/forms/FormInput.jsx';
import { createRegisterStudentSchema } from '../validation/registerStudentSchema.js';
import { UniversitySelect } from './UniversitySelect.jsx';
import { SubmitButton } from './SubmitButton.jsx';
import { fetchRegisterUniversitiesCatalog } from '../auth.service.js';
import { mapUniversitiesForSelect } from '../../../constants/universities.js';
import { useAuth } from '../hooks/useAuth.js';
import { getDashboardPathForRole } from '../../../utils/helpers.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

export function RegisterForm() {
  const { t, i18n } = useTranslation('auth');
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [formError, setFormError] = useState('');

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

  const universityOptions = useMemo(() => mapUniversitiesForSelect(universityRows), [universityRows]);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: '',
      email: '',
      password: '',
      confirm_password: '',
      university: '',
      phone: '',
    },
  });

  async function onSubmit(data) {
    setFormError('');
    const payload = {
      full_name: data.full_name.trim(),
      email: data.email.trim().toLowerCase(),
      password: data.password,
      university_id: data.university,
      phone: data.phone?.trim() || undefined,
    };

    try {
      const { redirectTo } = await signUp(payload);
      navigate(redirectTo ?? getDashboardPathForRole('student'), { replace: true });
    } catch (err) {
      setFormError(getApiErrorMessage(err, t('register.submitFailed')));
    }
  }

  return (
    <form className="auth-form auth-register__form" onSubmit={handleSubmit(onSubmit)} noValidate>
      {formError ? <p className="auth-form__error">{formError}</p> : null}

      <FormInput
        id="register-full-name"
        autoComplete="name"
        label={t('register.labels.fullName')}
        placeholder={t('register.placeholders.fullName')}
        error={errors.full_name?.message}
        {...register('full_name')}
      />

      <div className="auth-register__field-block">
        <FormInput
          id="register-email"
          type="email"
          autoComplete="email"
          label={t('register.labels.email')}
          placeholder={t('register.placeholders.email')}
          error={errors.email?.message}
          {...register('email')}
          aria-describedby="register-email-helper"
        />
        <p id="register-email-helper" className="auth-register__helper">
          {t('register.emailHelper')}
        </p>
      </div>

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
            {...field}
          />
        )}
      />

      {universitiesError ? (
        <p className="auth-form__error" role="alert">
          {getApiErrorMessage(universitiesErr, t('register.submitFailed'))}
        </p>
      ) : null}

      {!universitiesLoading && !universitiesError && universityOptions.length === 0 ? (
        <p className="auth-register__helper" role="status">
          {t('register.universitiesEmpty')}
        </p>
      ) : null}

      <FormInput
        id="register-password"
        type="password"
        autoComplete="new-password"
        label={t('register.labels.password')}
        placeholder={t('register.placeholders.password')}
        error={errors.password?.message}
        {...register('password')}
      />

      <FormInput
        id="register-confirm-password"
        type="password"
        autoComplete="new-password"
        label={t('register.labels.confirmPassword')}
        placeholder={t('register.placeholders.confirmPassword')}
        error={errors.confirm_password?.message}
        {...register('confirm_password')}
      />

      <FormInput
        id="register-phone"
        type="tel"
        autoComplete="tel"
        label={t('register.labels.phone')}
        placeholder={t('register.placeholders.phone')}
        error={errors.phone?.message}
        {...register('phone')}
      />

      <div className="auth-register__actions">
        <SubmitButton loading={isSubmitting}>{t('register.submit')}</SubmitButton>
      </div>

      <p className="auth-register__login-row">
        <span className="auth-register__login-text">{t('register.loginPrompt')}</span>{' '}
        <Link className="auth-register__link" to="/login">
          {t('register.loginLink')}
        </Link>
      </p>
    </form>
  );
}
