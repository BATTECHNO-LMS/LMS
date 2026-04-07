import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect } from '../../../components/forms/index.js';
import { adminCrudStore } from '../../../mocks/adminCrudStore.js';
import { trackSchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';

export function TrackCreatePage() {
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
      <AdminPageHeader title="إنشاء مسار" description="أدخل بيانات المسار التعليمي." />
      <form onSubmit={onSubmit} noValidate>
        <SectionCard
          title="البيانات"
          actions={
            <>
              <Link className="btn btn--outline" to="/admin/tracks">
                <X size={18} aria-hidden /> إلغاء
              </Link>
              <button type="submit" className="btn btn--primary">
                <Save size={18} aria-hidden /> حفظ
              </button>
            </>
          }
        >
          <div className="crud-form-grid">
            <FormInput id="name" label="اسم المسار" value={form.name} onChange={(e) => setField('name', e.target.value)} error={errors.name} />
            <FormInput id="code" label="الرمز" value={form.code} onChange={(e) => setField('code', e.target.value)} error={errors.code} />
            <FormInput id="level" label="المستوى" value={form.level} onChange={(e) => setField('level', e.target.value)} error={errors.level} />
            <FormSelect id="status" label="الحالة" value={form.status} onChange={(e) => setField('status', e.target.value)} error={errors.status}>
              <option value="active">نشط</option>
              <option value="draft">مسودة</option>
              <option value="inactive">غير نشط</option>
            </FormSelect>
          </div>
        </SectionCard>
      </form>
    </div>
  );
}
