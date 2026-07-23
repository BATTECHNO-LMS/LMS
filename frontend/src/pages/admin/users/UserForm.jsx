import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect, FormSwitch } from '../../../components/forms/index.js';
import { useLocale } from '../../../features/locale/index.js';
import { useAuth } from '../../../features/auth/index.js';
import { useTenant } from '../../../features/tenant/index.js';
import { useUniversities } from '../../../features/universities/index.js';
import { useUniversitySpecialties, getUniversitySpecialtyLabel } from '../../../features/specialties/index.js';
import { TENANT_SCOPE_ALL } from '../../../constants/tenants.js';
import {
  ASSIGNABLE_USER_ROLE_CODES,
  ROLES,
  roleRequiresUniversity,
  roleRequiresUniversitySpecialty,
} from '../../../constants/roles.js';
import { roleLabelAr } from '../../../utils/labelsAr.js';
import { tr } from '../../../utils/i18n.js';
import { userCreateFormSchema, userUpdateFormSchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';

function emptyCreateForm(scopeUniversityId) {
  return {
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    role: ROLES.STUDENT,
    status: 'inactive',
    email_verified: false,
    primary_university_id: scopeUniversityId || '',
    university_specialty_id: '',
  };
}

export function buildUserEditFormState(row) {
  const primaryRole = Array.isArray(row?.roles) && row.roles.length ? row.roles[0] : ROLES.STUDENT;
  return {
    full_name: row?.full_name || row?.name || '',
    email: row?.email || '',
    phone: row?.phone || '',
    role: primaryRole,
    status: row?.status || 'inactive',
    email_verified: Boolean(row?.email_verified_at),
    primary_university_id: row?.primary_university_id || '',
    university_specialty_id: row?.university_specialty_id || '',
  };
}

/**
 * Shared create/edit user form — fields match Prisma users + role-driven university/specialty.
 */
export function UserForm({
  mode = 'create',
  initial = null,
  submitting = false,
  formError = null,
  onSubmit,
  cancelTo,
}) {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { user: authUser } = useAuth();
  const { scopeId } = useTenant();
  const isGlobal = Boolean(authUser?.isGlobal);
  const scopedUniversityId =
    scopeId && scopeId !== TENANT_SCOPE_ALL ? String(scopeId) : '';

  const [form, setForm] = useState(() =>
    mode === 'edit' && initial
      ? buildUserEditFormState(initial)
      : emptyCreateForm(scopedUniversityId)
  );
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (mode === 'edit' && initial) {
      setForm(buildUserEditFormState(initial));
    }
  }, [mode, initial?.id, initial?.updated_at]);

  const universitiesQuery = useUniversities({ enabled: true });
  const uniId = form.primary_university_id || '';
  const specialtiesQuery = useUniversitySpecialties(uniId || undefined);

  const roleOptions = useMemo(() => {
    const codes = [...ASSIGNABLE_USER_ROLE_CODES];
    if (isGlobal) codes.unshift(ROLES.SUPER_ADMIN);
    if (mode === 'edit' && form.role === ROLES.SUPER_ADMIN && !codes.includes(ROLES.SUPER_ADMIN)) {
      codes.unshift(ROLES.SUPER_ADMIN);
    }
    return codes;
  }, [isGlobal, mode, form.role]);

  const universities = universitiesQuery.data?.universities || [];
  const specialties = specialtiesQuery.data || [];

  const needsUniversity = roleRequiresUniversity(form.role);
  const needsSpecialty = roleRequiresUniversitySpecialty(form.role);
  const showInstructorHints = form.role === ROLES.INSTRUCTOR;
  const showReviewerHints = form.role === ROLES.ACADEMIC_REVIEWER;
  const showAcademicCard =
    needsUniversity || needsSpecialty || showInstructorHints || showReviewerHints || form.role === ROLES.SUPER_ADMIN;

  function setField(key, value) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === 'role' && !roleRequiresUniversitySpecialty(value)) {
        next.university_specialty_id = '';
      }
      if (key === 'primary_university_id') {
        next.university_specialty_id = '';
      }
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const schema = mode === 'create' ? userCreateFormSchema : userUpdateFormSchema;
    const res = safeParse(schema, form);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors({});

    const data = res.data;
    const payload = {
      full_name: data.full_name.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone?.trim() || null,
      status: data.status,
      email_verified: Boolean(data.email_verified),
      role_codes: [data.role],
      primary_university_id: data.primary_university_id || null,
      university_specialty_id:
        data.role === ROLES.STUDENT ? data.university_specialty_id || null : null,
      specialty_id: null,
    };

    if (mode === 'create') {
      payload.password = data.password;
    }

    // Derive canonical specialty from selected university specialty on the client when known
    if (payload.university_specialty_id) {
      const match = specialties.find((s) => String(s.id) === String(payload.university_specialty_id));
      if (match?.canonicalSpecialtyId) {
        payload.specialty_id = match.canonicalSpecialtyId;
      }
    }

    await onSubmit(payload);
  }

  const universityOptions = useMemo(() => {
    if (scopedUniversityId) {
      return universities.filter((u) => String(u.id) === scopedUniversityId);
    }
    return universities;
  }, [universities, scopedUniversityId]);

  return (
    <form className="user-form" onSubmit={handleSubmit} noValidate>
      {formError ? <p className="auth-form__error user-form__banner">{formError}</p> : null}
      {errors._form ? <p className="auth-form__error user-form__banner">{errors._form}</p> : null}

      <SectionCard title={tr(isArabic, 'البيانات الشخصية', 'Personal details')}>
        <div className="crud-form-grid user-form__grid">
          <FormInput
            id="full_name"
            label={tr(isArabic, 'الاسم الكامل', 'Full name')}
            value={form.full_name}
            onChange={(e) => setField('full_name', e.target.value)}
            error={errors.full_name}
            autoComplete="name"
          />
          <FormInput
            id="phone"
            label={tr(isArabic, 'رقم الهاتف', 'Phone')}
            value={form.phone}
            onChange={(e) => setField('phone', e.target.value)}
            error={errors.phone}
            autoComplete="tel"
          />
        </div>
      </SectionCard>

      <SectionCard title={tr(isArabic, 'الحساب وتسجيل الدخول', 'Account & sign-in')}>
        <div className="crud-form-grid user-form__grid">
          <FormInput
            id="email"
            type="email"
            label={tr(isArabic, 'البريد الإلكتروني', 'Email')}
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            error={errors.email}
            autoComplete="email"
            disabled={mode === 'edit' ? false : false}
          />
          {mode === 'create' ? (
            <>
              <FormInput
                id="password"
                type="password"
                label={tr(isArabic, 'كلمة المرور', 'Password')}
                value={form.password}
                onChange={(e) => setField('password', e.target.value)}
                error={errors.password}
                autoComplete="new-password"
                passwordToggle
              />
              <FormInput
                id="confirm_password"
                type="password"
                label={tr(isArabic, 'تأكيد كلمة المرور', 'Confirm password')}
                value={form.confirm_password}
                onChange={(e) => setField('confirm_password', e.target.value)}
                error={errors.confirm_password}
                autoComplete="new-password"
                passwordToggle
              />
            </>
          ) : (
            <p className="user-form__hint">
              {tr(
                isArabic,
                'لإعادة تعيين كلمة المرور استخدم صفحة التفاصيل ← إعادة تعيين كلمة المرور.',
                'To reset the password, use the user details page → Reset password.'
              )}
            </p>
          )}
        </div>
      </SectionCard>

      <SectionCard title={tr(isArabic, 'الدور والصلاحيات', 'Role & permissions')}>
        <div className="crud-form-grid user-form__grid">
          <FormSelect
            id="role"
            label={tr(isArabic, 'الدور', 'Role')}
            value={form.role}
            onChange={(e) => setField('role', e.target.value)}
            error={errors.role}
          >
            {roleOptions.map((code) => (
              <option key={code} value={code}>
                {roleLabelAr(code, locale)}
              </option>
            ))}
          </FormSelect>
          {form.role === ROLES.ACADEMIC_REVIEWER ? (
            <p className="user-form__hint user-form__span-2">
              {tr(
                isArabic,
                'المراجع الأكاديمي يعمل ضمن نطاق جامعته فقط وبصلاحيات عرض.',
                'Academic reviewer is scoped to their university with view-only access.'
              )}
            </p>
          ) : null}
          {form.role === ROLES.SUPER_ADMIN && !isGlobal ? (
            <p className="form-field__error user-form__span-2">
              {tr(
                isArabic,
                'لا يمكن تعيين دور Super Admin إلا لمستخدم عالمي مخوّل.',
                'Only a trusted global admin can assign Super Admin.'
              )}
            </p>
          ) : null}
        </div>
      </SectionCard>

      {showAcademicCard && (
        <SectionCard
          title={tr(isArabic, 'البيانات الأكاديمية أو الوظيفية', 'Academic / organizational data')}
        >
          <div className="crud-form-grid user-form__grid">
            {(needsUniversity || form.role === ROLES.SUPER_ADMIN) && (
              <FormSelect
                id="primary_university_id"
                label={tr(isArabic, 'الجامعة المرتبطة', 'Linked university')}
                value={form.primary_university_id}
                onChange={(e) => setField('primary_university_id', e.target.value)}
                error={errors.primary_university_id}
                disabled={Boolean(scopedUniversityId)}
              >
                <option value="">{tr(isArabic, '— اختر الجامعة —', '— Select university —')}</option>
                {universityOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </FormSelect>
            )}

            {needsSpecialty ? (
              <FormSelect
                id="university_specialty_id"
                label={tr(isArabic, 'تخصص الجامعة', 'University specialty')}
                value={form.university_specialty_id}
                onChange={(e) => setField('university_specialty_id', e.target.value)}
                error={errors.university_specialty_id}
                disabled={!form.primary_university_id || specialtiesQuery.isLoading}
              >
                <option value="">
                  {!form.primary_university_id
                    ? tr(isArabic, 'اختر الجامعة أولًا', 'Select university first')
                    : specialtiesQuery.isLoading
                      ? tr(isArabic, 'جاري التحميل…', 'Loading…')
                      : tr(isArabic, '— اختر التخصص —', '— Select specialty —')}
                </option>
                {specialties.map((s) => (
                  <option key={s.id} value={s.id}>
                    {getUniversitySpecialtyLabel(s, locale)}
                    {s.code ? ` (${s.code})` : ''}
                  </option>
                ))}
              </FormSelect>
            ) : null}

            {needsSpecialty && form.university_specialty_id ? (
              <p className="user-form__hint user-form__span-2">
                {tr(
                  isArabic,
                  'يُربط التخصص المرجعي (Canonical) تلقائيًا من تخصص الجامعة عند الحفظ إن وُجد.',
                  'Canonical specialty is derived from the university specialty on save when linked.'
                )}
              </p>
            ) : null}

            {showInstructorHints ? (
              <p className="user-form__hint user-form__span-2">
                {tr(
                  isArabic,
                  'المدرّس يُربط بالجامعة فقط من هنا. التعيين على فرص التدريب الميداني يتم من صفحة الفرصة لاحقًا.',
                  'Instructors are linked to a university here only. Field-training assignment happens from the opportunity later.'
                )}
              </p>
            ) : null}

            {showReviewerHints ? (
              <p className="user-form__hint user-form__span-2">
                {tr(
                  isArabic,
                  'بيانات الطلاب والتقارير تُحصر لاحقًا حسب الجامعة المرتبطة بهذا الحساب.',
                  'Student data and reports are later scoped to this account’s university.'
                )}
              </p>
            ) : null}

            {!needsUniversity && !needsSpecialty && form.role === ROLES.SUPER_ADMIN ? (
              <p className="user-form__hint user-form__span-2">
                {tr(
                  isArabic,
                  'Super Admin عالمي؛ الجامعة اختيارية وليست مطلوبة للنطاق.',
                  'Super Admin is global; university is optional and not required for scope.'
                )}
              </p>
            ) : null}
          </div>
        </SectionCard>
      )}

      <SectionCard title={tr(isArabic, 'الحالة والتوثيق', 'Status & verification')}>
        <div className="crud-form-grid user-form__grid">
          <FormSelect
            id="status"
            label={tr(isArabic, 'حالة الحساب', 'Account status')}
            value={form.status}
            onChange={(e) => setField('status', e.target.value)}
            error={errors.status}
          >
            <option value="active">{tr(isArabic, 'مفعّل', 'Active')}</option>
            <option value="inactive">{tr(isArabic, 'غير مفعّل', 'Inactive')}</option>
            <option value="suspended">{tr(isArabic, 'موقوف', 'Suspended')}</option>
          </FormSelect>
          <FormSwitch
            id="email_verified"
            label={tr(isArabic, 'البريد موثّق', 'Email verified')}
            checked={Boolean(form.email_verified)}
            onChange={(e) => setField('email_verified', e.target.checked)}
          />
          <p className="user-form__hint user-form__span-2">
            {tr(
              isArabic,
              'التفعيل والتوثيق حالتان منفصلتان: توثيق البريد لا يفعّل الحساب، وتفعيل الحساب لا يوثّق البريد تلقائيًا.',
              'Activation and verification are separate: verifying email does not activate the account, and activating does not verify email.'
            )}
          </p>
        </div>
      </SectionCard>

      <div className="user-form__actions">
        <Link className="btn btn--outline" to={cancelTo}>
          <X size={18} aria-hidden /> {tr(isArabic, 'إلغاء', 'Cancel')}
        </Link>
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          <Save size={18} aria-hidden />{' '}
          {submitting
            ? tr(isArabic, 'جاري الحفظ…', 'Saving…')
            : mode === 'edit'
              ? tr(isArabic, 'تحديث', 'Update')
              : tr(isArabic, 'حفظ', 'Save')}
        </button>
      </div>
    </form>
  );
}
