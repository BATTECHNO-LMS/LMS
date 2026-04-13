import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect } from '../../../components/forms/index.js';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { universitySchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';
import { useLocale } from '../../../features/locale/index.js';
import { tr } from '../../../utils/i18n.js';
import { useUniversity, useUpdateUniversity } from '../../../features/universities/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

export function UniversityEditPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: row, isLoading, isError } = useUniversity(id);
  const updateUniversityMutation = useUpdateUniversity();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!row) return;
    setForm({
      name: row.name ?? '',
      contact: row.contact_person ?? '',
      email: row.contact_email ?? '',
      status: row.status ?? 'active',
      programs: 0,
    });
  }, [row]);

  function setField(key, value) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function onSubmit(e) {
    e.preventDefault();
    const res = safeParse(universitySchema, form);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    try {
      await updateUniversityMutation.mutateAsync({
        id,
        body: {
          name: res.data.name,
          contact_person: res.data.contact,
          contact_email: res.data.email,
          status: res.data.status,
        },
      });
      navigate(`/admin/universities/${id}`);
    } catch (err) {
      setErrors({
        _form: getApiErrorMessage(err, isArabic ? 'تعذّر التحديث.' : 'Could not update university.'),
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
          description={tr(isArabic, 'لم يتم العثور على الجامعة.', 'University not found.')}
        />
        <Link className="btn btn--primary" to="/admin/universities">
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
        title={tr(isArabic, 'تعديل جامعة', 'Edit university')}
        description={tr(isArabic, 'تحديث بيانات الجامعة.', 'Update university details.')}
      />
      <form onSubmit={onSubmit} noValidate>
        <SectionCard
          title={tr(isArabic, 'البيانات', 'Details')}
          actions={
            <>
              <Link className="btn btn--outline" to={`/admin/universities/${id}`}>
                <X size={18} aria-hidden /> {tr(isArabic, 'إلغاء', 'Cancel')}
              </Link>
              <button type="submit" className="btn btn--primary" disabled={updateUniversityMutation.isPending}>
                <Save size={18} aria-hidden /> {tr(isArabic, 'تحديث', 'Update')}
              </button>
            </>
          }
        >
          {errors._form ? <p className="auth-form__error">{errors._form}</p> : null}
          <div className="crud-form-grid">
            <FormInput
              id="name"
              label={tr(isArabic, 'اسم الجامعة', 'University name')}
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              error={errors.name}
            />
            <FormInput
              id="contact"
              label={tr(isArabic, 'جهة الاتصال', 'Contact')}
              value={form.contact}
              onChange={(e) => setField('contact', e.target.value)}
              error={errors.contact}
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
              id="status"
              label={tr(isArabic, 'الحالة', 'Status')}
              value={form.status}
              onChange={(e) => setField('status', e.target.value)}
              error={errors.status}
            >
              <option value="active">{tr(isArabic, 'نشط', 'Active')}</option>
              <option value="inactive">{tr(isArabic, 'غير نشط', 'Inactive')}</option>
              <option value="archived">{tr(isArabic, 'مؤرشف', 'Archived')}</option>
            </FormSelect>
          </div>
        </SectionCard>
      </form>
    </div>
  );
}
