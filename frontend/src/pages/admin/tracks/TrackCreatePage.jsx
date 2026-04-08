import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect } from '../../../components/forms/index.js';
import { adminCrudStore } from '../../../mocks/adminCrudStore.js';
import { trackSchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';
import { useLocale } from '../../../features/locale/index.js';
import { tr } from '../../../utils/i18n.js';

export function TrackCreatePage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    code: '',
    level: '',
    status: 'draft',
  });
  const [errors, setErrors] = useState({});

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSubmit(e) {
    e.preventDefault();
    const res = safeParse(trackSchema, form);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    adminCrudStore.tracks.create({ ...res.data, cohorts: 0 });
    navigate('/admin/tracks');
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader
        title={tr(isArabic, 'إنشاء مسار', 'Create track')}
        description={tr(isArabic, 'أدخل بيانات المسار التعليمي.', 'Enter track details.')}
      />
      <form onSubmit={onSubmit} noValidate>
        <SectionCard
          title={tr(isArabic, 'البيانات', 'Details')}
          actions={
            <>
              <Link className="btn btn--outline" to="/admin/tracks">
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
              label={tr(isArabic, 'اسم المسار', 'Track name')}
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              error={errors.name}
            />
            <FormInput
              id="code"
              label={tr(isArabic, 'الرمز', 'Code')}
              value={form.code}
              onChange={(e) => setField('code', e.target.value)}
              error={errors.code}
            />
            <FormInput
              id="level"
              label={tr(isArabic, 'المستوى', 'Level')}
              value={form.level}
              onChange={(e) => setField('level', e.target.value)}
              error={errors.level}
            />
            <FormSelect
              id="status"
              label={tr(isArabic, 'الحالة', 'Status')}
              value={form.status}
              onChange={(e) => setField('status', e.target.value)}
              error={errors.status}
            >
              <option value="active">{tr(isArabic, 'نشط', 'Active')}</option>
              <option value="draft">{tr(isArabic, 'مسودة', 'Draft')}</option>
              <option value="inactive">{tr(isArabic, 'غير نشط', 'Inactive')}</option>
            </FormSelect>
          </div>
        </SectionCard>
      </form>
    </div>
  );
}
