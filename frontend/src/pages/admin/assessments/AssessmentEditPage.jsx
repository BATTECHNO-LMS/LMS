import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect, FormNumber, FormDate, FormTextarea, FormSwitch } from '../../../components/forms/index.js';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { useCohorts } from '../../../features/cohorts/index.js';
import { useRubrics } from '../../../features/rubrics/index.js';
import { useAssessment, useUpdateAssessment } from '../../../features/assessments/index.js';
import { fetchLearningOutcomesByMicroCredential } from '../../../features/learningOutcomes/learningOutcomes.service.js';
import { assessmentApiSchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { usePortalPathPrefix } from '../../../utils/portalPathPrefix.js';

const TYPES = ['quiz', 'assignment', 'lab', 'practical_exam', 'milestone', 'capstone_project', 'presentation'];
const STATUSES = ['draft', 'published', 'open', 'closed', 'archived'];

export function AssessmentEditPage() {
  const base = usePortalPathPrefix();
  const { t } = useTranslation('assessments');
  const { t: tCommon } = useTranslation('common');
  const { id } = useParams();
  const navigate = useNavigate();
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
      assessment_type: data.assessment_type ?? 'assignment',
      weight: String(data.weight ?? ''),
      cohort_id: data.cohort_id ?? '',
      micro_credential_id: data.micro_credential_id ?? '',
      due_date: data.due_date ? String(data.due_date).slice(0, 10) : '',
      open_at: data.open_at ? String(data.open_at).slice(0, 10) : '',
      linked_outcome_id: data.linked_outcome_id ?? '',
      rubric_id: data.rubric_id ?? '',
      instructions: data.instructions ?? '',
      status: data.status ?? 'draft',
      timeLimitMinutes: data.time_limit_minutes != null ? String(data.time_limit_minutes) : '',
      maxAttempts: String(data.max_attempts ?? 1),
      shuffleQuestions: Boolean(data.shuffle_questions),
      questionBankRef: data.question_bank_ref ?? '',
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
      cohort_id: cid,
      micro_credential_id: c?.micro_credential?.id ?? '',
      linked_outcome_id: '',
    }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!form || !id) return;
    setApiError('');
    const payload = {
      title: form.title,
      assessment_type: form.assessment_type,
      weight: form.weight,
      cohort_id: form.cohort_id,
      micro_credential_id: form.micro_credential_id,
      due_date: form.due_date,
      open_at: form.open_at || undefined,
      linked_outcome_id: form.linked_outcome_id || undefined,
      rubric_id: form.rubric_id || undefined,
      instructions: form.instructions || undefined,
      status: form.status,
    };
    const isQuiz = form.assessment_type === 'quiz';
    if (isQuiz) {
      payload.time_limit_minutes =
        String(form.timeLimitMinutes).trim() === '' ? null : Number(form.timeLimitMinutes);
      payload.max_attempts = Math.min(50, Math.max(1, Number(form.maxAttempts) || 1));
      payload.shuffle_questions = Boolean(form.shuffleQuestions);
      payload.question_bank_ref = String(form.questionBankRef).trim() || null;
    } else {
      payload.time_limit_minutes = null;
      payload.max_attempts = 1;
      payload.shuffle_questions = false;
      payload.question_bank_ref = null;
    }
    payload.preferred_submission_type = data.preferred_submission_type ?? null;
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

  if (isLoading || !form) {
    return (
      <div className="page page--admin crud-page">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="page page--admin crud-page">
        <AdminPageHeader title={t('view.notFound')} description="" />
        <Link className="btn btn--primary" to={`${base}/assessments`}>
          {tCommon('actions.backToList')}
        </Link>
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={<>{t('edit.title')}</>} description={<>{t('edit.description')}</>} />
      <form onSubmit={onSubmit} noValidate>
        <SectionCard
          title={tCommon('actions.details')}
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
            <FormSelect
              id="assessment_type"
              label={t('instructorCreate.fields.type')}
              value={form.assessment_type}
              onChange={(e) => setField('assessment_type', e.target.value)}
              error={errors.assessment_type}
            >
              {TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {t(`typeLabels.${ty}`, { defaultValue: ty })}
                </option>
              ))}
            </FormSelect>
            <FormNumber
              id="weight"
              label={t('instructorCreate.fields.weight')}
              value={form.weight}
              onChange={(e) => setField('weight', e.target.value)}
              error={errors.weight}
              min={0}
              max={100}
            />
            <FormSelect id="cohort_id" label={t('instructorCreate.fields.cohort')} value={form.cohort_id} onChange={onCohortChange} error={errors.cohort_id}>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </FormSelect>
            <FormDate id="due_date" label={t('table.dueDate')} value={form.due_date} onChange={(e) => setField('due_date', e.target.value)} error={errors.due_date} />
            <FormDate id="open_at" label={t('instructorCreate.fields.openDate')} value={form.open_at} onChange={(e) => setField('open_at', e.target.value)} error={errors.open_at} />
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
            <FormSelect id="rubric_id" label={t('instructorCreate.fields.rubric')} value={form.rubric_id} onChange={(e) => setField('rubric_id', e.target.value)} error={errors.rubric_id}>
              <option value="">—</option>
              {rubrics.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </FormSelect>
            <FormSelect id="status" label={tCommon('status.label')} value={form.status} onChange={(e) => setField('status', e.target.value)} error={errors.status}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </FormSelect>
            <FormTextarea id="instructions" label={t('instructorCreate.fields.instructions')} value={form.instructions} onChange={(e) => setField('instructions', e.target.value)} error={errors.instructions} rows={4} />
          </div>
        </SectionCard>
        {form.assessment_type === 'quiz' ? (
          <SectionCard title={t('instructorCreate.sections.quiz')}>
            <p className="assessment-form__hint">{t('instructorCreate.hints.timeLimitOptional')}</p>
            <div className="crud-form-grid">
              <FormNumber
                id="timeLimitMinutes"
                label={t('instructorCreate.fields.timeLimitMinutes')}
                value={form.timeLimitMinutes}
                onChange={(e) => setField('timeLimitMinutes', e.target.value)}
                min={1}
                max={10080}
                error={errors.time_limit_minutes}
              />
              <FormNumber
                id="maxAttempts"
                label={t('instructorCreate.fields.maxAttempts')}
                value={form.maxAttempts}
                onChange={(e) => setField('maxAttempts', e.target.value)}
                min={1}
                max={50}
                error={errors.max_attempts}
              />
              <FormInput
                id="questionBankRef"
                label={t('instructorCreate.fields.questionBankRef')}
                value={form.questionBankRef}
                onChange={(e) => setField('questionBankRef', e.target.value)}
                error={errors.question_bank_ref}
              />
              <FormSwitch
                id="shuffleQuestions"
                label={t('instructorCreate.fields.shuffleQuestions')}
                checked={form.shuffleQuestions}
                onChange={(e) => setField('shuffleQuestions', e.target.checked)}
                error={errors.shuffle_questions}
              />
            </div>
            <p className="assessment-form__hint">{t('instructorCreate.hints.quizQuestionBank')}</p>
          </SectionCard>
        ) : null}
      </form>
    </div>
  );
}
