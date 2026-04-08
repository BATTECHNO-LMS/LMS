import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect } from '../../../components/forms/index.js';
import { adminCrudStore } from '../../../mocks/adminCrudStore.js';
import { recognitionSchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';
import { useLocale } from '../../../features/locale/index.js';
import { tr } from '../../../utils/i18n.js';

export function RecognitionRequestEditPage() {
  const { isArabic } = useLocale();
  const { id } = useParams();
  const navigate = useNavigate();
  const unis = useMemo(() => adminCrudStore.universities.getAll(), []);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const row = adminCrudStore.recognition.getById(id);
    if (!row) {
      navigate('/admin/recognition-requests', { replace: true });
      return;
    }
    setForm({
      title: row.title,
      universityId: row.universityId,
      universityName: row.universityName,
      credentialName: row.credentialName,
      cohortName: row.cohortName,
      status: row.status,
    });
  }, [id, navigate]);

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
    adminCrudStore.recognition.update(id, { ...res.data });
    navigate(`/admin/recognition-requests/${id}`);
  }

  if (!form) return null;

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader
        title={tr(isArabic, 'تعديل طلب اعتراف', 'Edit recognition request')}
        description={tr(isArabic, 'تحديث بيانات الطلب.', 'Update request details.')}
      />
      <form onSubmit={onSubmit} noValidate>
        <SectionCard
          title={tr(isArabic, 'البيانات', 'Details')}
          actions={
            <>
              <Link className="btn btn--outline" to={`/admin/recognition-requests/${id}`}>
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
