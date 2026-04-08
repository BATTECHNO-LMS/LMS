import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect, FormNumber } from '../../../components/forms/index.js';
import { adminCrudStore } from '../../../mocks/adminCrudStore.js';
import { microCredentialSchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';
import { useLocale } from '../../../features/locale/index.js';
import { tr } from '../../../utils/i18n.js';

export function MicroCredentialCreatePage() {
  const { isArabic } = useLocale();
  const navigate = useNavigate();
  const tracks = useMemo(() => adminCrudStore.tracks.getAll(), []);
  const [form, setForm] = useState({
    name: '',
    code: '',
    level: '',
    hours: '',
    status: 'draft',
    trackId: tracks[0]?.id ?? '',
  });
  const [errors, setErrors] = useState({});

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSubmit(e) {
    e.preventDefault();
    const res = safeParse(microCredentialSchema, form);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    adminCrudStore.microCredentials.create({ ...res.data, cohorts: 0 });
    navigate('/admin/micro-credentials');
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader
        title={tr(isArabic, 'إنشاء شهادة مصغرة', 'Create micro-credential')}
        description={tr(isArabic, 'أدخل بيانات الشهادة والمسار المرتبط.', 'Enter credential details and linked track.')}
      />
      <form onSubmit={onSubmit} noValidate>
        <SectionCard
          title={tr(isArabic, 'البيانات', 'Details')}
          actions={
            <>
              <Link className="btn btn--outline" to="/admin/micro-credentials">
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
            <FormNumber
              id="hours"
              label={tr(isArabic, 'الساعات', 'Hours')}
              value={form.hours}
              onChange={(e) => setField('hours', e.target.value)}
              error={errors.hours}
              min={1}
            />
            <FormSelect
              id="trackId"
              label={tr(isArabic, 'المسار', 'Track')}
              value={form.trackId}
              onChange={(e) => setField('trackId', e.target.value)}
              error={errors.trackId}
            >
              {tracks.length === 0 ? (
                <option value="">{tr(isArabic, 'لا توجد مسارات', 'No tracks')}</option>
              ) : null}
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </FormSelect>
            <FormSelect
              id="status"
              label={tr(isArabic, 'الحالة', 'Status')}
              value={form.status}
              onChange={(e) => setField('status', e.target.value)}
              error={errors.status}
            >
              <option value="draft">{tr(isArabic, 'مسودة', 'Draft')}</option>
              <option value="approved">{tr(isArabic, 'معتمد', 'Approved')}</option>
              <option value="archived">{tr(isArabic, 'مؤرشف', 'Archived')}</option>
            </FormSelect>
          </div>
        </SectionCard>
      </form>
    </div>
  );
}
