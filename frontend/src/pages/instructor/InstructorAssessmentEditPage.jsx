import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ASSESSMENT_TYPE_OPTIONS,
  ASSESSMENT_TYPE_VALUES,
  SUBMISSION_TYPE_OPTIONS,
} from '../../constants/permissions.js';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect, FormNumber, FormTextarea, FormDate } from '../../components/forms/index.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { PagePermissionGate } from '../../components/permissions/PagePermissionGate.jsx';
import { UI_PERMISSION } from '../../constants/permissions.js';
import { useCohorts } from '../../features/cohorts/index.js';
import { useRubrics } from '../../features/rubrics/index.js';
import { useAssessment, useUpdateAssessment } from '../../features/assessments/index.js';
import { fetchLearningOutcomesByMicroCredential } from '../../features/learningOutcomes/learningOutcomes.service.js';
import { assessmentApiSchema } from '../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../utils/zodErrors.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';
import { usePortalPathPrefix } from '../../utils/portalPathPrefix.js';

export function InstructorAssessmentEditPage() {
  const base = usePortalPathPrefix();
  const { t } = useTranslation('assessments');
  const { t: tCommon } = useTranslation('common');
  const { id } = useParams();
  const navigate = useNavigate();
  const P = UI_PERMISSION;
  const { data, isLoading, isError } = useAssessment(id);
  const updateMut = useUpdateAssessment();
  const { data: cohortsPayload } = useCohorts({}, { staleTime: 60_000 });
  const cohorts = cohortsPayload?.cohorts ?? [];
  const { data: rubricsPayload } = useRubrics({}, { staleTime: 60_000 });
  const rubrics = rubricsPayload?.rubrics ?? [];

  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    if (!data) return;
    setForm({
      title: data.title ?? '',
      type: data.assessment_type ?? ASSESSMENT_TYPE_VALUES.ASSIGNMENT,
      weight: String(data.weight ?? ''),
      cohortId: data.cohort_id ?? '',
      micro_credential_id: data.micro_credential_id ?? '',
      linked_outcome_id: data.linked_outcome_id ?? '',
      openDate: data.open_at ? String(data.open_at).slice(0, 10) : '',
      closeDate: data.due_date ? String(data.due_date).slice(0, 10) : '',
      instructions: data.instructions ?? '',
      rubric_id: data.rubric_id ?? '',
      status: data.status ?? 'draft',
      submissionRequired: 'file_upload',
    });
  }, [data]);

  const mcId = form?.micro_credential_id;
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

  const type = form?.type;
  const showSubmissionTypes =
    type === ASSESSMENT_TYPE_VALUES.ASSIGNMENT ||
    type === ASSESSMENT_TYPE_VALUES.LAB ||
    type === ASSESSMENT_TYPE_VALUES.CAPSTONE_PROJECT;

  async function onSubmit(e) {
    e.preventDefault();
    if (!form || !id) return;
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
      await updateMut.mutateAsync({ id, body: res.data });
      navigate(`${base}/assessments/${id}`);
    } catch (err) {
      setApiError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  return (
    <PagePermissionGate permission={P.canEditAssessments}>
      {isLoading || !form ? (
        <div className="page page--instructor crud-page">
          <LoadingSpinner />
        </div>
      ) : isError || !data ? (
        <div className="page page--instructor crud-page">
          <AdminPageHeader title={t('view.notFound')} description="" />
          <Link className="btn btn--primary" to={`${base}/assessments`}>
            {tCommon('actions.backToList')}
          </Link>
        </div>
      ) : (
        <div className="page page--dashboard page--instructor">
          <AdminPageHeader title={<>{t('edit.title')}</>} description={<>{t('edit.description')}</>} />
          <form onSubmit={onSubmit} className="assessment-form" noValidate>
            <SectionCard
              title={<>{t('instructorCreate.sections.basic')}</>}
              actions={
                <>
                  <Link className="btn btn--outline" to={`${base}/assessments/${id}`}>
                    <X size={18} aria-hidden /> {tCommon('actions.cancel')}
                  </Link>
                  <button type="submit" className="btn btn--primary" disabled={updateMut.isPending}>
                    <Save size={18} aria-hidden /> {tCommon('actions.save')}
                  </button>
                </>
              }
            >
              {apiError ? <p className="form-error">{apiError}</p> : null}
              <div className="crud-form-grid">
                <FormInput id="title" label={t('instructorCreate.fields.title')} value={form.title} onChange={(e) => setField('title', e.target.value)} error={errors.title} />
                <FormSelect id="type" label={t('instructorCreate.fields.type')} value={form.type} onChange={(e) => setField('type', e.target.value)} error={errors.assessment_type}>
                  {ASSESSMENT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {t(`typeLabels.${o.value}`, { defaultValue: o.label })}
                    </option>
                  ))}
                </FormSelect>
                <FormNumber id="weight" label={t('instructorCreate.fields.weight')} value={form.weight} onChange={(e) => setField('weight', e.target.value)} error={errors.weight} min={0} max={100} />
                <FormSelect id="cohortId" label={t('instructorCreate.fields.cohort')} value={form.cohortId} onChange={onCohortChange} error={errors.cohort_id}>
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
                <FormDate id="openDate" label={t('instructorCreate.fields.openDate')} value={form.openDate} onChange={(e) => setField('openDate', e.target.value)} error={errors.open_at} />
                <FormDate id="closeDate" label={t('instructorCreate.fields.closeDate')} value={form.closeDate} onChange={(e) => setField('closeDate', e.target.value)} error={errors.due_date} />
                <FormTextarea id="instructions" label={t('instructorCreate.fields.instructions')} rows={4} value={form.instructions} onChange={(e) => setField('instructions', e.target.value)} error={errors.instructions} />
                <FormSelect id="rubric_id" label={t('instructorCreate.fields.rubric')} value={form.rubric_id} onChange={(e) => setField('rubric_id', e.target.value)} error={errors.rubric_id}>
                  <option value="">—</option>
                  {rubrics.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </FormSelect>
                <FormSelect id="status" label={tCommon('status.label')} value={form.status} onChange={(e) => setField('status', e.target.value)} error={errors.status}>
                  {['draft', 'published', 'open', 'closed', 'archived'].map((s) => (
                    <option key={s} value={s}>
                      {s}
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
              </SectionCard>
            ) : null}
          </form>
        </div>
      )}
    </PagePermissionGate>
  );
}
