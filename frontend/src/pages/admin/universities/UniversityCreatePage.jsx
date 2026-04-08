import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect, FormNumber } from '../../../components/forms/index.js';
import { adminCrudStore } from '../../../mocks/adminCrudStore.js';
import { universitySchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';
import { useLocale } from '../../../features/locale/index.js';
import { tr } from '../../../utils/i18n.js';

export function UniversityCreatePage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    contact: '',
    email: '',
    status: 'active',
    programs: '',
  });
  const [errors, setErrors] = useState({});

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSubmit(e) {
    e.preventDefault();
    const payload = {
      ...form,
      programs: form.programs === '' ? undefined : form.programs,
    };
    const res = safeParse(universitySchema, payload);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    adminCrudStore.universities.create({ ...res.data, programs: res.data.programs ?? 0 });
    navigate('/admin/universities');
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
              <button type="submit" className="btn btn--primary">
                <Save size={18} aria-hidden /> {tr(isArabic, 'حفظ', 'Save')}
              </button>
            </>
          }
        >
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
              <option value="suspended">{tr(isArabic, 'موقوف', 'Suspended')}</option>
            </FormSelect>
            <FormNumber
              id="programs"
              label={tr(isArabic, 'عدد البرامج (اختياري)', 'Program count (optional)')}
              value={form.programs}
              onChange={(e) => setField('programs', e.target.value)}
              error={errors.programs}
              min={0}
            />
          </div>
        </SectionCard>
      </form>
    </div>
  );
}
