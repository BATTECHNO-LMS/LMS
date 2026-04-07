import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import {
  ASSESSMENT_TYPE_OPTIONS,
  ASSESSMENT_TYPE_VALUES,
  SUBMISSION_TYPE_OPTIONS,
} from '../../constants/permissions.js';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect, FormNumber, FormTextarea, FormDate } from '../../components/forms/index.js';
import { getInstructorAssessmentById } from '../../mocks/instructorAssessmentWorkspace.js';

export function InstructorAssessmentEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);

  useEffect(() => {
    const row = getInstructorAssessmentById(id);
    if (!row) {
      navigate('/instructor/assessments', { replace: true });
      return;
    }
    setForm({
      title: row.name,
      type: row.type,
      weight: String(row.weight),
      cohortId: '1',
      learningOutcome: row.learningOutcome,
      openDate: row.openDate,
      closeDate: row.closeDate,
      instructions: '',
      rubric: '',
      submissionRequired: 'file_upload',
    });
  }, [id, navigate]);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  if (!form) return null;

  const type = form.type;
  const showQuizSection = type === ASSESSMENT_TYPE_VALUES.QUIZ;
  const showSubmissionTypes =
    type === ASSESSMENT_TYPE_VALUES.ASSIGNMENT ||
    type === ASSESSMENT_TYPE_VALUES.LAB ||
    type === ASSESSMENT_TYPE_VALUES.CAPSTONE_PROJECT;
  const showPresentationSection = type === ASSESSMENT_TYPE_VALUES.PRESENTATION;

  function onSubmit(e) {
    e.preventDefault();
    navigate('/instructor/assessments');
  }

  return (
    <div className="page page--dashboard page--instructor">
      <AdminPageHeader title="تعديل التقييم" description="تحديث بيانات التقييم والمواعيد والتعليمات." />
      <form onSubmit={onSubmit} className="assessment-form" noValidate>
        <SectionCard
          title="البيانات"
          actions={
            <>
              <Link className="btn btn--outline" to="/instructor/assessments">
                <X size={18} aria-hidden /> إلغاء
              </Link>
              <button type="submit" className="btn btn--primary">
                <Save size={18} aria-hidden /> تحديث
              </button>
            </>
          }
        >
          <div className="crud-form-grid">
            <FormInput id="title" label="عنوان التقييم" value={form.title} onChange={(e) => setField('title', e.target.value)} />
            <FormSelect id="type" label="النوع" value={form.type} onChange={(e) => setField('type', e.target.value)}>
              {ASSESSMENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </FormSelect>
            <FormNumber id="weight" label="الوزن %" value={form.weight} onChange={(e) => setField('weight', e.target.value)} min={0} max={100} />
            <FormSelect id="cohortId" label="الدفعة" value={form.cohortId} onChange={(e) => setField('cohortId', e.target.value)}>
              <option value="1">دفعة ربيع 2026</option>
            </FormSelect>
            <FormInput
              id="learningOutcome"
              label="مخرج التعلم"
              value={form.learningOutcome}
              onChange={(e) => setField('learningOutcome', e.target.value)}
            />
            <FormDate id="openDate" label="تاريخ الفتح" value={form.openDate} onChange={(e) => setField('openDate', e.target.value)} />
            <FormDate id="closeDate" label="تاريخ الإغلاق" value={form.closeDate} onChange={(e) => setField('closeDate', e.target.value)} />
            <FormTextarea
              id="instructions"
              label="التعليمات"
              rows={4}
              value={form.instructions}
              onChange={(e) => setField('instructions', e.target.value)}
            />
            <FormTextarea id="rubric" label="Rubric" rows={3} value={form.rubric} onChange={(e) => setField('rubric', e.target.value)} />
          </div>
        </SectionCard>

        {showSubmissionTypes ? (
          <SectionCard title="نوع التسليم المطلوب">
            <FormSelect
              id="submissionRequired"
              label="التسليم"
              value={form.submissionRequired}
              onChange={(e) => setField('submissionRequired', e.target.value)}
            >
              {SUBMISSION_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.labelAr}
                </option>
              ))}
            </FormSelect>
          </SectionCard>
        ) : null}

        {showQuizSection ? (
          <SectionCard title="إعدادات الاختبار (تجريبي)">
            <p className="assessment-form__placeholder">placeholder — تكامل لاحق.</p>
          </SectionCard>
        ) : null}

        {showPresentationSection ? (
          <SectionCard title="مرفقات العرض التقديمي">
            <p className="assessment-form__placeholder">placeholder — تكامل لاحق.</p>
          </SectionCard>
        ) : null}
      </form>
    </div>
  );
}
