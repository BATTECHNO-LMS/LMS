import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect } from '../../../components/forms/index.js';
import { adminCrudStore } from '../../../mocks/adminCrudStore.js';
import { recognitionSchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';

export function RecognitionRequestEditPage() {
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
      <AdminPageHeader title="تعديل طلب اعتراف" description="تحديث بيانات الطلب." />
      <form onSubmit={onSubmit} noValidate>
        <SectionCard
          title="البيانات"
          actions={
            <>
              <Link className="btn btn--outline" to={`/admin/recognition-requests/${id}`}>
                <X size={18} aria-hidden /> إلغاء
              </Link>
              <button type="submit" className="btn btn--primary">
                <Save size={18} aria-hidden /> تحديث
              </button>
            </>
          }
        >
          <div className="crud-form-grid">
            <FormInput id="title" label="عنوان الطلب" value={form.title} onChange={(e) => setField('title', e.target.value)} error={errors.title} />
            <FormSelect id="universityId" label="الجامعة" value={form.universityId} onChange={onUniversityChange} error={errors.universityId}>
              {unis.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </FormSelect>
            <FormInput
              id="credentialName"
              label="اسم الشهادة"
              value={form.credentialName}
              onChange={(e) => setField('credentialName', e.target.value)}
              error={errors.credentialName}
            />
            <FormInput id="cohortName" label="اسم الدفعة" value={form.cohortName} onChange={(e) => setField('cohortName', e.target.value)} error={errors.cohortName} />
            <FormSelect id="status" label="الحالة" value={form.status} onChange={(e) => setField('status', e.target.value)} error={errors.status}>
              <option value="draft">مسودة</option>
              <option value="pending">قيد المراجعة</option>
              <option value="approved">معتمد</option>
              <option value="rejected">مرفوض</option>
            </FormSelect>
          </div>
        </SectionCard>
      </form>
    </div>
  );
}
