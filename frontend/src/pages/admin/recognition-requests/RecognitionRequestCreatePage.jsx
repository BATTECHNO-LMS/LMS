import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect } from '../../../components/forms/index.js';
import { adminCrudStore } from '../../../mocks/adminCrudStore.js';
import { recognitionSchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';
import { useLocale } from '../../../features/locale/index.js';
import { tr } from '../../../utils/i18n.js';

export function RecognitionRequestCreatePage() {
  const { isArabic } = useLocale();
  const navigate = useNavigate();
  const unis = useMemo(() => adminCrudStore.universities.getAll(), []);
  const first = unis[0];
  const [form, setForm] = useState({
    title: '',
    universityId: first?.id ?? '',
    universityName: first?.name ?? '',
    credentialName: '',
    cohortName: '',
    status: 'draft',
  });
  const [errors, setErrors] = useState({});

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onUniversityChange(e) {
    const uid = e.target.value;
    const u = adminCrudStore.universities.getById(uid);
    setForm((f) => ({ ...f, universityId: uid, universityName: u?.name ?? '' }));
  }

  function onSubmit(e) {
    e.preventDefault();
    const res = safeParse(recognitionSchema, form);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    adminCrudStore.recognition.create({ ...res.data });
    navigate('/admin/recognition-requests');
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader
        title={tr(isArabic, 'إنشاء طلب اعتراف', 'Create recognition request')}
        description={tr(isArabic, 'تسجيل طلب اعتراف أكاديمي جديد.', 'Register a new academic recognition request.')}
      />
      <form onSubmit={onSubmit} noValidate>
        <SectionCard
          title={tr(isArabic, 'البيانات', 'Details')}
          actions={
            <>
              <Link className="btn btn--outline" to="/admin/recognition-requests">
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
              id="title"
              label={tr(isArabic, 'عنوان الطلب', 'Request title')}
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              error={errors.title}
            />
            <FormSelect
              id="universityId"
              label={tr(isArabic, 'الجامعة', 'University')}
              value={form.universityId}
              onChange={onUniversityChange}
              error={errors.universityId}
            >
              {unis.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </FormSelect>
            <FormInput
              id="credentialName"
              label={tr(isArabic, 'اسم الشهادة', 'Certificate name')}
              value={form.credentialName}
              onChange={(e) => setField('credentialName', e.target.value)}
              error={errors.credentialName}
            />
            <FormInput
              id="cohortName"
              label={tr(isArabic, 'اسم الدفعة', 'Cohort name')}
              value={form.cohortName}
              onChange={(e) => setField('cohortName', e.target.value)}
              error={errors.cohortName}
            />
            <FormSelect
              id="status"
              label={tr(isArabic, 'الحالة', 'Status')}
              value={form.status}
              onChange={(e) => setField('status', e.target.value)}
              error={errors.status}
            >
              <option value="draft">{tr(isArabic, 'مسودة', 'Draft')}</option>
              <option value="pending">{tr(isArabic, 'قيد المراجعة', 'Pending review')}</option>
              <option value="approved">{tr(isArabic, 'معتمد', 'Approved')}</option>
              <option value="rejected">{tr(isArabic, 'مرفوض', 'Rejected')}</option>
            </FormSelect>
          </div>
        </SectionCard>
      </form>
    </div>
  );
}
