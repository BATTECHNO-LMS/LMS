import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect, FormNumber, FormDate } from '../../../components/forms/index.js';
import { adminCrudStore } from '../../../mocks/adminCrudStore.js';
import { assessmentSchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';

export function AssessmentCreatePage() {
  const navigate = useNavigate();
  const cohorts = useMemo(() => adminCrudStore.cohorts.getAll(), []);
  const first = cohorts[0];
  const [form, setForm] = useState({
    name: '',
    type: 'quiz',
    weight: '0',
    cohortId: first?.id ?? '',
    cohortName: first?.name ?? '',
    dueDate: '',
    status: 'draft',
  });
  const [errors, setErrors] = useState({});

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onCohortChange(e) {
    const cid = e.target.value;
    const c = adminCrudStore.cohorts.getById(cid);
    setForm((f) => ({ ...f, cohortId: cid, cohortName: c?.name ?? '' }));
  }

  function onSubmit(e) {
    e.preventDefault();
    const res = safeParse(assessmentSchema, form);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    adminCrudStore.assessments.create({ ...res.data });
    navigate('/admin/assessments');
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title="إنشاء تقييم" description="ربط التقييم بالدفعة وتحديد الوزن والموعد." />
      <form onSubmit={onSubmit} noValidate>
        <SectionCard
          title="البيانات"
          actions={
            <>
              <Link className="btn btn--outline" to="/admin/assessments">
                <X size={18} aria-hidden /> إلغاء
              </Link>
              <button type="submit" className="btn btn--primary">
                <Save size={18} aria-hidden /> حفظ
              </button>
            </>
          }
        >
          <div className="crud-form-grid">
            <FormInput id="name" label="اسم التقييم" value={form.name} onChange={(e) => setField('name', e.target.value)} error={errors.name} />
            <FormSelect id="type" label="النوع" value={form.type} onChange={(e) => setField('type', e.target.value)} error={errors.type}>
              <option value="quiz">اختبار</option>
              <option value="assignment">واجب</option>
              <option value="project">مشروع</option>
              <option value="exam">امتحان</option>
            </FormSelect>
            <FormNumber id="weight" label="الوزن %" value={form.weight} onChange={(e) => setField('weight', e.target.value)} error={errors.weight} min={0} max={100} />
            <FormSelect id="cohortId" label="الدفعة" value={form.cohortId} onChange={onCohortChange} error={errors.cohortId}>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </FormSelect>
            <FormDate id="dueDate" label="تاريخ الاستحقاق" value={form.dueDate} onChange={(e) => setField('dueDate', e.target.value)} error={errors.dueDate} />
            <FormSelect id="status" label="الحالة" value={form.status} onChange={(e) => setField('status', e.target.value)} error={errors.status}>
              <option value="draft">مسودة</option>
              <option value="pending">قيد المراجعة</option>
              <option value="published">منشور</option>
              <option value="closed">مغلق</option>
            </FormSelect>
          </div>
        </SectionCard>
      </form>
    </div>
  );
}
