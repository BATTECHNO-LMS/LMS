import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect, FormDate } from '../../../components/forms/index.js';
import { adminCrudStore } from '../../../mocks/adminCrudStore.js';
import { cohortSchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';
import { useLocale } from '../../../features/locale/index.js';
import { tr } from '../../../utils/i18n.js';

export function CohortEditPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { id } = useParams();
  const navigate = useNavigate();
  const micros = useMemo(() => adminCrudStore.microCredentials.getAll(), []);
  const unis = useMemo(() => adminCrudStore.universities.getAll(), []);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const row = adminCrudStore.cohorts.getById(id);
    if (!row) {
      navigate('/admin/cohorts', { replace: true });
      return;
    }
    setForm({
      name: row.name,
      credentialId: row.credentialId,
      credentialName: row.credentialName,
      universityId: row.universityId,
      universityName: row.universityName,
      instructor: row.instructor,
      startDate: row.startDate,
      endDate: row.endDate,
      status: row.status,
    });
  }, [id, navigate]);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onCredentialChange(e) {
    const cid = e.target.value;
    const mc = adminCrudStore.microCredentials.getById(cid);
    setForm((f) => ({ ...f, credentialId: cid, credentialName: mc?.name ?? '' }));
  }

  function onUniversityChange(e) {
    const uid = e.target.value;
    const u = adminCrudStore.universities.getById(uid);
    setForm((f) => ({ ...f, universityId: uid, universityName: u?.name ?? '' }));
  }

  function onSubmit(e) {
    e.preventDefault();
    const res = safeParse(cohortSchema, form);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    adminCrudStore.cohorts.update(id, { ...res.data });
    navigate(`/admin/cohorts/${id}`);
  }

  if (!form) return null;

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader
        title={tr(isArabic, 'تعديل دفعة', 'Edit batch')}
        description={tr(isArabic, 'تحديث بيانات الدفعة.', 'Update batch details.')}
      />
      <form onSubmit={onSubmit} noValidate>
        <SectionCard
          title={tr(isArabic, 'البيانات', 'Details')}
          actions={
            <>
              <Link className="btn btn--outline" to={`/admin/cohorts/${id}`}>
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
              label={tr(isArabic, 'اسم الدفعة', 'Batch name')}
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              error={errors.name}
            />
            <FormSelect
              id="credentialId"
              label={tr(isArabic, 'الشهادة', 'Certificate')}
              value={form.credentialId}
              onChange={onCredentialChange}
              error={errors.credentialId}
            >
              {micros.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </FormSelect>
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
              id="instructor"
              label={tr(isArabic, 'المدرّب', 'Trainer')}
              value={form.instructor}
              onChange={(e) => setField('instructor', e.target.value)}
              error={errors.instructor}
            />
            <FormDate
              id="startDate"
              label={tr(isArabic, 'تاريخ البداية', 'Start date')}
              value={form.startDate}
              onChange={(e) => setField('startDate', e.target.value)}
              error={errors.startDate}
            />
            <FormDate
              id="endDate"
              label={tr(isArabic, 'تاريخ النهاية', 'End date')}
              value={form.endDate}
              onChange={(e) => setField('endDate', e.target.value)}
              error={errors.endDate}
            />
            <FormSelect
              id="status"
              label={tr(isArabic, 'الحالة', 'Status')}
              value={form.status}
              onChange={(e) => setField('status', e.target.value)}
              error={errors.status}
            >
              <option value="planned">{tr(isArabic, 'مخطط', 'Planned')}</option>
              <option value="running">{tr(isArabic, 'قيد التنفيذ', 'In progress')}</option>
              <option value="completed">{tr(isArabic, 'مكتمل', 'Completed')}</option>
              <option value="cancelled">{tr(isArabic, 'ملغى', 'Cancelled')}</option>
            </FormSelect>
          </div>
        </SectionCard>
      </form>
    </div>
  );
}
