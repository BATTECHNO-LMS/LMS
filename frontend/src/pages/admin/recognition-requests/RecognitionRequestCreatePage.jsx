import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect } from '../../../components/forms/index.js';
import { adminCrudStore } from '../../../mocks/adminCrudStore.js';
import { recognitionSchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';

export function RecognitionRequestCreatePage() {
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
      <AdminPageHeader title="إنشاء طلب اعتراف" description="تسجيل طلب اعتراف أكاديمي جديد." />
      <form onSubmit={onSubmit} noValidate>
        <SectionCard
          title="البيانات"
          actions={
            <>
              <Link className="btn btn--outline" to="/admin/recognition-requests">
                <X size={18} aria-hidden /> إلغاء
              </Link>
              <button type="submit" className="btn btn--primary">
                <Save size={18} aria-hidden /> حفظ
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
