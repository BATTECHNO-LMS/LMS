import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect } from '../../../components/forms/index.js';
import { adminCrudStore } from '../../../mocks/adminCrudStore.js';
import { userSchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';
import { useLocale } from '../../../features/locale/index.js';
import { useTenant } from '../../../features/tenant/index.js';
import { TENANT_SCOPE_ALL } from '../../../constants/tenants.js';
import { tr } from '../../../utils/i18n.js';

export function UserCreatePage() {
  const { locale } = useLocale();
  const { scopeId } = useTenant();
  const isArabic = locale === 'ar';
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'instructor',
    status: 'active',
  });
  const [errors, setErrors] = useState({});

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSubmit(e) {
    e.preventDefault();
    const res = safeParse(userSchema, form);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    const tenantId = scopeId === TENANT_SCOPE_ALL ? 'uni-1' : scopeId;
    adminCrudStore.users.create({ ...res.data, lastLogin: '—', tenantId });
    navigate('/admin/users');
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
              <button type="submit" className="btn btn--primary">
                <Save size={18} aria-hidden /> {tr(isArabic, 'حفظ', 'Save')}
              </button>
            </>
          }
        >
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
            <FormSelect
              id="role"
              label={tr(isArabic, 'الدور', 'Role')}
              value={form.role}
              onChange={(e) => setField('role', e.target.value)}
              error={errors.role}
            >
              <option value="instructor">{tr(isArabic, 'مدرّس', 'Instructor')}</option>
              <option value="student">{tr(isArabic, 'طالب', 'Student')}</option>
              <option value="admin">{tr(isArabic, 'إداري', 'Admin')}</option>
              <option value="qa_officer">{tr(isArabic, 'مسؤول جودة', 'QA Officer')}</option>
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
            </FormSelect>
          </div>
        </SectionCard>
      </form>
    </div>
  );
}
