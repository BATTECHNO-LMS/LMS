import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Save, X } from 'lucide-react';
import {
  ASSESSMENT_TYPE_OPTIONS,
  ASSESSMENT_TYPE_VALUES,
  SUBMISSION_TYPE_OPTIONS,
} from '../../constants/permissions.js';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect, FormNumber, FormTextarea, FormDate } from '../../components/forms/index.js';
import { PagePermissionGate } from '../../components/permissions/PagePermissionGate.jsx';
import { UI_PERMISSION } from '../../constants/permissions.js';

export function InstructorAssessmentCreatePage() {
  const { t } = useTranslation('assessments');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const P = UI_PERMISSION;

  const [form, setForm] = useState({
    title: '',
    type: ASSESSMENT_TYPE_VALUES.QUIZ,
    weight: '10',
    cohortId: '1',
    learningOutcome: '',
    openDate: '',
    closeDate: '',
    instructions: '',
    rubric: '',
    submissionRequired: 'file_upload',
  });

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

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
    <PagePermissionGate permission={P.canCreateAssessments}>
      <div className="page page--dashboard page--instructor">
        <AdminPageHeader title={<>{t('instructorCreate.title')}</>} description={<>{t('instructorCreate.description')}</>} />
        <form onSubmit={onSubmit} className="assessment-form" noValidate>
          <SectionCard
            title={<>{t('instructorCreate.sections.basic')}</>}
            actions={
              <>
                <Link className="btn btn--outline" to="/instructor/assessments">
                  <X size={18} aria-hidden /> {tCommon('actions.cancel')}
                </Link>
                <button type="submit" className="btn btn--primary">
                  <Save size={18} aria-hidden /> {tCommon('actions.save')}
                </button>
              </>
            }
          >
            <div className="crud-form-grid">
              <FormInput
                id="title"
                label={t('instructorCreate.fields.title')}
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
              />
              <FormSelect id="type" label={t('instructorCreate.fields.type')} value={form.type} onChange={(e) => setField('type', e.target.value)}>
                {ASSESSMENT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(`typeLabels.${o.value}`, { defaultValue: o.label })}
                  </option>
                ))}
              </FormSelect>
              <FormNumber
                id="weight"
                label={t('instructorCreate.fields.weight')}
                value={form.weight}
                onChange={(e) => setField('weight', e.target.value)}
                min={0}
                max={100}
              />
              <FormSelect id="cohortId" label={t('instructorCreate.fields.cohort')} value={form.cohortId} onChange={(e) => setField('cohortId', e.target.value)}>
                <option value="1">{t('instructorCreate.cohorts.spring2026')}</option>
              </FormSelect>
              <FormInput
                id="learningOutcome"
                label={t('instructorCreate.fields.learningOutcome')}
                value={form.learningOutcome}
                onChange={(e) => setField('learningOutcome', e.target.value)}
              />
              <FormDate
                id="openDate"
                label={t('instructorCreate.fields.openDate')}
                value={form.openDate}
                onChange={(e) => setField('openDate', e.target.value)}
              />
              <FormDate
                id="closeDate"
                label={t('instructorCreate.fields.closeDate')}
                value={form.closeDate}
                onChange={(e) => setField('closeDate', e.target.value)}
              />
              <FormTextarea
                id="instructions"
                label={t('instructorCreate.fields.instructions')}
                rows={4}
                value={form.instructions}
                onChange={(e) => setField('instructions', e.target.value)}
              />
              <FormTextarea
                id="rubric"
                label={t('instructorCreate.fields.rubric')}
                rows={3}
                value={form.rubric}
                onChange={(e) => setField('rubric', e.target.value)}
              />
            </div>
          </SectionCard>

          {showSubmissionTypes ? (
            <SectionCard title={<>{t('instructorCreate.sections.submissionType')}</>}>
              <FormSelect
                id="submissionRequired"
                label={t('instructorCreate.fields.submission')}
                value={form.submissionRequired}
                onChange={(e) => setField('submissionRequired', e.target.value)}
              >
                {SUBMISSION_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(`instructorCreate.submissionTypes.${o.value}`)}
                  </option>
                ))}
              </FormSelect>
              <p className="assessment-form__hint">{t('instructorCreate.hints.submissionSettings')}</p>
            </SectionCard>
          ) : null}

          {showQuizSection ? (
            <SectionCard title={<>{t('instructorCreate.sections.quiz')}</>}>
              <p className="assessment-form__placeholder">{t('instructorCreate.hints.quizPlaceholder')}</p>
            </SectionCard>
          ) : null}

          {showPresentationSection ? (
            <SectionCard title={<>{t('instructorCreate.sections.presentation')}</>}>
              <p className="assessment-form__placeholder">{t('instructorCreate.hints.presentationPlaceholder')}</p>
            </SectionCard>
          ) : null}
        </form>
      </div>
    </PagePermissionGate>
  );
}
