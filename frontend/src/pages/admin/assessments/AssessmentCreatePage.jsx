import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect, FormNumber, FormDate } from '../../../components/forms/index.js';
import { adminCrudStore } from '../../../mocks/adminCrudStore.js';
import { assessmentSchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';
import { useLocale } from '../../../features/locale/index.js';
import { tr } from '../../../utils/i18n.js';

export function AssessmentCreatePage() {
  const { isArabic } = useLocale();
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
      <AdminPageHeader
        title={tr(isArabic, 'إنشاء تقييم', 'Create assessment')}
        description={tr(isArabic, 'ربط التقييم بالدفعة وتحديد الوزن والموعد.', 'Link the assessment to a cohort and set weight and due date.')}
      />
      <form onSubmit={onSubmit} noValidate>
        <SectionCard
          title={tr(isArabic, 'البيانات', 'Details')}
          actions={
            <>
              <Link className="btn btn--outline" to="/admin/assessments">
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
              label={tr(isArabic, 'اسم التقييم', 'Assessment name')}
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              error={errors.name}
            />
            <FormSelect
              id="type"
              label={tr(isArabic, 'النوع', 'Type')}
              value={form.type}
              onChange={(e) => setField('type', e.target.value)}
              error={errors.type}
            >
              <option value="quiz">{tr(isArabic, 'اختبار', 'Quiz')}</option>
              <option value="assignment">{tr(isArabic, 'واجب', 'Assignment')}</option>
              <option value="project">{tr(isArabic, 'مشروع', 'Project')}</option>
              <option value="exam">{tr(isArabic, 'امتحان', 'Exam')}</option>
            </FormSelect>
            <FormNumber
              id="weight"
              label={tr(isArabic, 'الوزن %', 'Weight %')}
              value={form.weight}
              onChange={(e) => setField('weight', e.target.value)}
              error={errors.weight}
              min={0}
              max={100}
            />
            <FormSelect
              id="cohortId"
              label={tr(isArabic, 'الدفعة', 'Cohort')}
              value={form.cohortId}
              onChange={onCohortChange}
              error={errors.cohortId}
            >
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </FormSelect>
            <FormDate
              id="dueDate"
              label={tr(isArabic, 'تاريخ الاستحقاق', 'Due date')}
              value={form.dueDate}
              onChange={(e) => setField('dueDate', e.target.value)}
              error={errors.dueDate}
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
              <option value="published">{tr(isArabic, 'منشور', 'Published')}</option>
              <option value="closed">{tr(isArabic, 'مغلق', 'Closed')}</option>
            </FormSelect>
          </div>
        </SectionCard>
      </form>
    </div>
  );
}
