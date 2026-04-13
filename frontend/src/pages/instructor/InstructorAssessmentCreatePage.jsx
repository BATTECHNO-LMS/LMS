import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
import { useCohorts } from '../../features/cohorts/index.js';
import { useRubrics } from '../../features/rubrics/index.js';
import { useCreateAssessment } from '../../features/assessments/index.js';
import { fetchLearningOutcomesByMicroCredential } from '../../features/learningOutcomes/learningOutcomes.service.js';
import { assessmentApiSchema } from '../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../utils/zodErrors.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

export function InstructorAssessmentCreatePage() {
  const { t } = useTranslation('assessments');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const P = UI_PERMISSION;
  const createMut = useCreateAssessment();

  const { data: cohortsPayload } = useCohorts({}, { staleTime: 60_000 });
  const cohorts = cohortsPayload?.cohorts ?? [];
  const { data: rubricsPayload } = useRubrics({}, { staleTime: 60_000 });
  const rubrics = rubricsPayload?.rubrics ?? [];

  const [form, setForm] = useState({
    title: '',
    type: ASSESSMENT_TYPE_VALUES.QUIZ,
    weight: '10',
    cohortId: '',
    micro_credential_id: '',
    linked_outcome_id: '',
    openDate: '',
    closeDate: '',
    instructions: '',
    rubric_id: '',
    status: 'draft',
    submissionRequired: 'file_upload',
  });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    if (!cohorts.length || form.cohortId) return;
    const c = cohorts[0];
    setForm((f) => ({
      ...f,
      cohortId: c.id,
      micro_credential_id: c.micro_credential?.id ?? '',
    }));
  }, [cohorts, form.cohortId]);

  const selectedCohort = cohorts.find((c) => String(c.id) === String(form.cohortId));
  const mcId = form.micro_credential_id || selectedCohort?.micro_credential?.id;

  const { data: loData } = useQuery({
    queryKey: ['learning-outcomes', 'mc', mcId],
    queryFn: () => fetchLearningOutcomesByMicroCredential(mcId),
    enabled: Boolean(mcId),
    staleTime: 60_000,
  });
  const outcomes = loData?.learning_outcomes ?? [];

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onCohortChange(e) {
    const cid = e.target.value;
    const c = cohorts.find((x) => String(x.id) === cid);
    setForm((f) => ({
      ...f,
      cohortId: cid,
      micro_credential_id: c?.micro_credential?.id ?? '',
      linked_outcome_id: '',
    }));
  }

  const type = form.type;
  const showQuizSection = type === ASSESSMENT_TYPE_VALUES.QUIZ;
  const showSubmissionTypes =
    type === ASSESSMENT_TYPE_VALUES.ASSIGNMENT ||
    type === ASSESSMENT_TYPE_VALUES.LAB ||
    type === ASSESSMENT_TYPE_VALUES.CAPSTONE_PROJECT;
  const showPresentationSection = type === ASSESSMENT_TYPE_VALUES.PRESENTATION;

  async function onSubmit(e) {
    e.preventDefault();
    setApiError('');
    const payload = {
      title: form.title,
      assessment_type: form.type,
      weight: form.weight,
      cohort_id: form.cohortId,
      micro_credential_id: form.micro_credential_id,
      due_date: form.closeDate,
      open_at: form.openDate || undefined,
      linked_outcome_id: form.linked_outcome_id || undefined,
      rubric_id: form.rubric_id || undefined,
      instructions: form.instructions || undefined,
      status: form.status,
    };
    const res = safeParse(assessmentApiSchema, payload);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors({});
    try {
      const created = await createMut.mutateAsync(res.data);
      navigate(`/instructor/assessments/${created.id}`);
    } catch (err) {
      setApiError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
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
                <button type="submit" className="btn btn--primary" disabled={createMut.isPending}>
                  <Save size={18} aria-hidden /> {tCommon('actions.save')}
                </button>
              </>
            }
          >
            {apiError ? <p className="form-error">{apiError}</p> : null}
            <div className="crud-form-grid">
              <FormInput
                id="title"
                label={t('instructorCreate.fields.title')}
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                error={errors.title}
              />
              <FormSelect id="type" label={t('instructorCreate.fields.type')} value={form.type} onChange={(e) => setField('type', e.target.value)} error={errors.assessment_type}>
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
                error={errors.weight}
              />
              <FormSelect id="cohortId" label={t('instructorCreate.fields.cohort')} value={form.cohortId} onChange={onCohortChange} error={errors.cohort_id}>
                <option value="">—</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </FormSelect>
              <FormSelect
                id="linked_outcome_id"
                label={t('instructorCreate.fields.learningOutcome')}
                value={form.linked_outcome_id}
                onChange={(e) => setField('linked_outcome_id', e.target.value)}
                error={errors.linked_outcome_id}
              >
                <option value="">—</option>
                {outcomes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.outcome_code}
                  </option>
                ))}
              </FormSelect>
              <FormDate
                id="openDate"
                label={t('instructorCreate.fields.openDate')}
                value={form.openDate}
                onChange={(e) => setField('openDate', e.target.value)}
                error={errors.open_at}
              />
              <FormDate
                id="closeDate"
                label={t('instructorCreate.fields.closeDate')}
                value={form.closeDate}
                onChange={(e) => setField('closeDate', e.target.value)}
                error={errors.due_date}
              />
              <FormTextarea
                id="instructions"
                label={t('instructorCreate.fields.instructions')}
                rows={4}
                value={form.instructions}
                onChange={(e) => setField('instructions', e.target.value)}
                error={errors.instructions}
              />
              <FormSelect id="rubric_id" label={t('instructorCreate.fields.rubric')} value={form.rubric_id} onChange={(e) => setField('rubric_id', e.target.value)} error={errors.rubric_id}>
                <option value="">—</option>
                {rubrics.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </FormSelect>
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
