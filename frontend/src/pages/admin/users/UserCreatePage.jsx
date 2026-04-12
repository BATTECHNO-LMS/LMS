import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect } from '../../../components/forms/index.js';
import { userSchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';
import { useLocale } from '../../../features/locale/index.js';
import { useTenant } from '../../../features/tenant/index.js';
import { TENANT_SCOPE_ALL } from '../../../constants/tenants.js';
import { tr } from '../../../utils/i18n.js';
import { useCreateUser } from '../../../features/users/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

export function UserCreatePage() {
  const { locale } = useLocale();
  const { scopeId } = useTenant();
  const isArabic = locale === 'ar';
  const navigate = useNavigate();
  const createUserMutation = useCreateUser();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'instructor',
    status: 'active',
  });
  const [errors, setErrors] = useState({});

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    const res = safeParse(userSchema, form);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    const primary =
      scopeId && scopeId !== TENANT_SCOPE_ALL ? scopeId : undefined;
    try {
      await createUserMutation.mutateAsync({
        full_name: res.data.name,
        email: res.data.email,
        password: res.data.password,
        role_codes: [res.data.role],
        status: res.data.status,
        primary_university_id: primary,
      });
      navigate('/admin/users');
    } catch (err) {
      setErrors({
        _form: getApiErrorMessage(err, isArabic ? 'تعذّر إنشاء المستخدم.' : 'Could not create user.'),
      });
    }
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader
        title={tr(isArabic, 'إنشاء مستخدم', 'Create user')}
        description={tr(isArabic, 'أدخل بيانات المستخدم الجديد ثم احفظ.', 'Enter the new user details, then save.')}
      />
      <form onSubmit={onSubmit} noValidate>
        <SectionCard
          title={tr(isArabic, 'البيانات الأساسية', 'Basic details')}
          actions={
            <>
              <Link className="btn btn--outline" to="/admin/users">
                <X size={18} aria-hidden /> {tr(isArabic, 'إلغاء', 'Cancel')}
              </Link>
              <button type="submit" className="btn btn--primary" disabled={createUserMutation.isPending}>
                <Save size={18} aria-hidden /> {tr(isArabic, 'حفظ', 'Save')}
              </button>
            </>
          }
        >
          {errors._form ? <p className="auth-form__error">{errors._form}</p> : null}
          <div className="crud-form-grid">
            <FormInput
              id="name"
              label={tr(isArabic, 'الاسم', 'Name')}
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              error={errors.name}
              autoComplete="name"
            />
            <FormInput
              id="email"
              label={tr(isArabic, 'البريد الإلكتروني', 'Email')}
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              error={errors.email}
              autoComplete="email"
            />
            <FormInput
              id="password"
              label={tr(isArabic, 'كلمة المرور', 'Password')}
              type="password"
              value={form.password}
              onChange={(e) => setField('password', e.target.value)}
              error={errors.password}
              autoComplete="new-password"
            />
            <FormSelect
              id="role"
              label={tr(isArabic, 'الدور', 'Role')}
              value={form.role}
              onChange={(e) => setField('role', e.target.value)}
              error={errors.role}
            >
              <option value="instructor">{tr(isArabic, 'مدرّس', 'Instructor')}</option>
              <option value="student">{tr(isArabic, 'طالب', 'Student')}</option>
              <option value="program_admin">{tr(isArabic, 'إداري برامج', 'Program admin')}</option>
              <option value="qa_officer">{tr(isArabic, 'مسؤول جودة', 'QA Officer')}</option>
              <option value="academic_admin">{tr(isArabic, 'إداري أكاديمي', 'Academic admin')}</option>
            </FormSelect>
            <FormSelect
              id="status"
              label={tr(isArabic, 'الحالة', 'Status')}
              value={form.status}
              onChange={(e) => setField('status', e.target.value)}
              error={errors.status}
            >
              <option value="active">{tr(isArabic, 'نشط', 'Active')}</option>
              <option value="inactive">{tr(isArabic, 'غير نشط', 'Inactive')}</option>
              <option value="suspended">{tr(isArabic, 'موقوف', 'Suspended')}</option>
            </FormSelect>
          </div>
        </SectionCard>
      </form>
    </div>
  );
}
