import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect } from '../../../components/forms/index.js';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { userUpdateSchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';
import { useLocale } from '../../../features/locale/index.js';
import { tr } from '../../../utils/i18n.js';
import { useUser, useUpdateUser } from '../../../features/users/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

export function UserEditPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: row, isLoading, isError } = useUser(id);
  const updateUserMutation = useUpdateUser();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!row) return;
    const primaryRole = Array.isArray(row.roles) && row.roles.length ? row.roles[0] : 'instructor';
    setForm({
      name: row.full_name ?? row.name ?? '',
      role: primaryRole,
      status: row.status ?? 'active',
      phone: row.phone ?? '',
    });
  }, [row]);

  function setField(key, value) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function onSubmit(e) {
    e.preventDefault();
    const res = safeParse(userUpdateSchema, form);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    try {
      await updateUserMutation.mutateAsync({
        id,
        body: {
          full_name: res.data.name,
          status: res.data.status,
          role_codes: [res.data.role],
          phone: res.data.phone || null,
        },
      });
      navigate(`/admin/users/${id}`);
    } catch (err) {
      setErrors({
        _form: getApiErrorMessage(err, isArabic ? 'تعذّر التحديث.' : 'Could not update.'),
      });
    }
  }

  if (isLoading) {
    return (
      <div className="page page--admin crud-page">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError || !row) {
    return (
      <div className="page page--admin crud-page">
        <AdminPageHeader
          title={tr(isArabic, 'غير موجود', 'Not found')}
          description={tr(isArabic, 'لم يتم العثور على المستخدم.', 'User not found.')}
        />
        <Link className="btn btn--primary" to="/admin/users">
          {tr(isArabic, 'العودة للقائمة', 'Back to list')}
        </Link>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="page page--admin crud-page">
        <LoadingSpinner />
      </div>
    );
  }

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
              <button type="submit" className="btn btn--primary" disabled={updateUserMutation.isPending}>
                <Save size={18} aria-hidden /> {tr(isArabic, 'تحديث', 'Update')}
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
            />
            <FormInput
              id="phone"
              label={tr(isArabic, 'الهاتف', 'Phone')}
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              error={errors.phone}
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
