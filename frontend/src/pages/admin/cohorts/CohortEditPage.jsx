import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect, FormDate } from '../../../components/forms/index.js';
import { adminCrudStore } from '../../../mocks/adminCrudStore.js';
import { cohortSchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';

export function CohortEditPage() {
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
      <AdminPageHeader title="تعديل دفعة" description="تحديث بيانات الدفعة." />
      <form onSubmit={onSubmit} noValidate>
        <SectionCard
          title="البيانات"
          actions={
            <>
              <Link className="btn btn--outline" to={`/admin/cohorts/${id}`}>
                <X size={18} aria-hidden /> إلغاء
              </Link>
              <button type="submit" className="btn btn--primary">
                <Save size={18} aria-hidden /> تحديث
              </button>
            </>
          }
        >
          <div className="crud-form-grid">
            <FormInput id="name" label="اسم الدفعة" value={form.name} onChange={(e) => setField('name', e.target.value)} error={errors.name} />
            <FormSelect id="credentialId" label="الشهادة" value={form.credentialId} onChange={onCredentialChange} error={errors.credentialId}>
              {micros.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </FormSelect>
            <FormSelect id="universityId" label="الجامعة" value={form.universityId} onChange={onUniversityChange} error={errors.universityId}>
              {unis.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </FormSelect>
            <FormInput id="instructor" label="المدرّب" value={form.instructor} onChange={(e) => setField('instructor', e.target.value)} error={errors.instructor} />
            <FormDate id="startDate" label="تاريخ البداية" value={form.startDate} onChange={(e) => setField('startDate', e.target.value)} error={errors.startDate} />
            <FormDate id="endDate" label="تاريخ النهاية" value={form.endDate} onChange={(e) => setField('endDate', e.target.value)} error={errors.endDate} />
            <FormSelect id="status" label="الحالة" value={form.status} onChange={(e) => setField('status', e.target.value)} error={errors.status}>
              <option value="planned">مخطط</option>
              <option value="running">قيد التنفيذ</option>
              <option value="completed">مكتمل</option>
              <option value="cancelled">ملغى</option>
            </FormSelect>
          </div>
        </SectionCard>
      </form>
    </div>
  );
}
