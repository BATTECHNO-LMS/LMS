import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect } from '../../../components/forms/index.js';
import { adminCrudStore } from '../../../mocks/adminCrudStore.js';
import { userSchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';
import { useLocale } from '../../../features/locale/index.js';
import { tr } from '../../../utils/i18n.js';

export function UserEditPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const row = adminCrudStore.users.getById(id);
    if (!row) {
      navigate('/admin/users', { replace: true });
      return;
    }
    setForm({
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.status,
    });
  }, [id, navigate]);

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
    adminCrudStore.users.update(id, { ...res.data });
    navigate(`/admin/users/${id}`);
  }

  if (!form) return null;

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader
        title={tr(isArabic, 'تعديل مستخدم', 'Edit user')}
        description={tr(isArabic, 'تحديث بيانات المستخدم المحدد.', 'Update the selected user.')}
      />
      <form onSubmit={onSubmit} noValidate>
        <SectionCard
          title={tr(isArabic, 'البيانات', 'Details')}
          actions={
            <>
              <Link className="btn btn--outline" to={`/admin/users/${id}`}>
                <X size={18} aria-hidden /> {tr(isArabic, 'إلغاء', 'Cancel')}
              </Link>
              <button type="submit" className="btn btn--primary">
                <Save size={18} aria-hidden /> {tr(isArabic, 'تحديث', 'Update')}
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
            />
            <FormInput
              id="email"
              label={tr(isArabic, 'البريد الإلكتروني', 'Email')}
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              error={errors.email}
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
