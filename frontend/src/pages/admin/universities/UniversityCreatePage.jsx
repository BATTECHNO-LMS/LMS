import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect } from '../../../components/forms/index.js';
import { universitySchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';
import { useLocale } from '../../../features/locale/index.js';
import { tr } from '../../../utils/i18n.js';
import { useCreateUniversity } from '../../../features/universities/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

export function UniversityCreatePage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const navigate = useNavigate();
  const createUniversityMutation = useCreateUniversity();
  const [form, setForm] = useState({
    name: '',
    contact: '',
    email: '',
    status: 'active',
  });
  const [errors, setErrors] = useState({});

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    const res = safeParse(universitySchema, { ...form, programs: undefined });
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    try {
      await createUniversityMutation.mutateAsync({
        name: res.data.name,
        contact_person: res.data.contact,
        contact_email: res.data.email,
        status: res.data.status,
        partnership_state: 'active',
      });
      navigate('/admin/universities');
    } catch (err) {
      setErrors({
        _form: getApiErrorMessage(err, isArabic ? 'تعذّر إنشاء الجامعة.' : 'Could not create university.'),
      });
    }
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader
        title={tr(isArabic, 'إنشاء جامعة', 'Create university')}
        description={tr(isArabic, 'أدخل بيانات الجامعة ثم احفظ.', 'Enter university details, then save.')}
      />
      <form onSubmit={onSubmit} noValidate>
        <SectionCard
          title={tr(isArabic, 'البيانات', 'Details')}
          actions={
            <>
              <Link className="btn btn--outline" to="/admin/universities">
                <X size={18} aria-hidden /> {tr(isArabic, 'إلغاء', 'Cancel')}
              </Link>
              <button type="submit" className="btn btn--primary" disabled={createUniversityMutation.isPending}>
                <Save size={18} aria-hidden /> {tr(isArabic, 'حفظ', 'Save')}
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
