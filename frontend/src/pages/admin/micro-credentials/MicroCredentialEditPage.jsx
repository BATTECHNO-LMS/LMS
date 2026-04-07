import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect, FormNumber } from '../../../components/forms/index.js';
import { adminCrudStore } from '../../../mocks/adminCrudStore.js';
import { microCredentialSchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';

export function MicroCredentialEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const tracks = useMemo(() => adminCrudStore.tracks.getAll(), []);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const row = adminCrudStore.microCredentials.getById(id);
    if (!row) {
      navigate('/admin/micro-credentials', { replace: true });
      return;
    }
    setForm({
      name: row.name,
      code: row.code,
      level: row.level,
      hours: row.hours,
      status: row.status,
      trackId: row.trackId,
    });
  }, [id, navigate]);

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
    adminCrudStore.microCredentials.update(id, { ...res.data });
    navigate(`/admin/micro-credentials/${id}`);
  }

  if (!form) return null;

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title="تعديل شهادة مصغرة" description="تحديث بيانات الشهادة." />
      <form onSubmit={onSubmit} noValidate>
        <SectionCard
          title="البيانات"
          actions={
            <>
              <Link className="btn btn--outline" to={`/admin/micro-credentials/${id}`}>
                <X size={18} aria-hidden /> إلغاء
              </Link>
              <button type="submit" className="btn btn--primary">
                <Save size={18} aria-hidden /> تحديث
              </button>
            </>
          }
        >
          <div className="crud-form-grid">
            <FormInput id="name" label="الاسم" value={form.name} onChange={(e) => setField('name', e.target.value)} error={errors.name} />
            <FormInput id="code" label="الرمز" value={form.code} onChange={(e) => setField('code', e.target.value)} error={errors.code} />
            <FormInput id="level" label="المستوى" value={form.level} onChange={(e) => setField('level', e.target.value)} error={errors.level} />
            <FormNumber id="hours" label="الساعات" value={form.hours} onChange={(e) => setField('hours', e.target.value)} error={errors.hours} min={1} />
            <FormSelect id="trackId" label="المسار" value={form.trackId} onChange={(e) => setField('trackId', e.target.value)} error={errors.trackId}>
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </FormSelect>
            <FormSelect id="status" label="الحالة" value={form.status} onChange={(e) => setField('status', e.target.value)} error={errors.status}>
              <option value="draft">مسودة</option>
              <option value="approved">معتمد</option>
              <option value="archived">مؤرشف</option>
            </FormSelect>
          </div>
        </SectionCard>
      </form>
    </div>
  );
}
