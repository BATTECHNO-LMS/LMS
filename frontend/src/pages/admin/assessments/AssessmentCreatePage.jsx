import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput, FormSelect, FormNumber, FormDate, FormTextarea, FormSwitch } from '../../../components/forms/index.js';
import { useCohorts } from '../../../features/cohorts/index.js';
import { useRubrics } from '../../../features/rubrics/index.js';
import { useCreateAssessment } from '../../../features/assessments/index.js';
import { fetchLearningOutcomesByMicroCredential } from '../../../features/learningOutcomes/learningOutcomes.service.js';
import { assessmentApiSchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { usePortalPathPrefix } from '../../../utils/portalPathPrefix.js';

const TYPES = ['quiz', 'assignment', 'lab', 'practical_exam', 'milestone', 'capstone_project', 'presentation'];
const STATUSES = ['draft', 'published', 'open', 'closed', 'archived'];

export function AssessmentCreatePage() {
  const base = usePortalPathPrefix();
  const { t } = useTranslation('assessments');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const createMut = useCreateAssessment();

  const { data: cohortsPayload } = useCohorts({}, { staleTime: 60_000 });
  const cohorts = cohortsPayload?.cohorts ?? [];
  const { data: rubricsPayload } = useRubrics({}, { staleTime: 60_000 });
  const rubrics = rubricsPayload?.rubrics ?? [];

  const [form, setForm] = useState({
    title: '',
    assessment_type: 'assignment',
    weight: '10',
    cohort_id: '',
    micro_credential_id: '',
    due_date: '',
    open_at: '',
    linked_outcome_id: '',
    rubric_id: '',
    instructions: '',
    status: 'draft',
    timeLimitMinutes: '',
    maxAttempts: '1',
    shuffleQuestions: false,
    questionBankRef: '',
  });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');

  const selectedCohort = useMemo(
    () => cohorts.find((c) => String(c.id) === String(form.cohort_id)),
    [cohorts, form.cohort_id]
  );

  useEffect(() => {
    if (!cohorts.length || form.cohort_id) return;
    const c = cohorts[0];
    setForm((f) => ({
      ...f,
      cohort_id: c.id,
      micro_credential_id: c.micro_credential?.id ?? '',
    }));
  }, [cohorts, form.cohort_id]);

  useEffect(() => {
    if (!selectedCohort?.micro_credential?.id) return;
    setForm((f) =>
      f.micro_credential_id === selectedCohort.micro_credential.id
        ? f
        : { ...f, micro_credential_id: selectedCohort.micro_credential.id, linked_outcome_id: '' }
    );
  }, [selectedCohort]);

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
      cohort_id: cid,
      micro_credential_id: c?.micro_credential?.id ?? '',
      linked_outcome_id: '',
    }));
  }

  async function onSubmit(e) {
    e.preventDefault();
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
    payload.preferred_submission_type = null;
    const res = safeParse(assessmentApiSchema, payload);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors({});
    try {
      const created = await createMut.mutateAsync(res.data);
      navigate(`${base}/assessments/${created.id}`);
    } catch (err) {
      setApiError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={<>{t('create.title')}</>} description={<>{t('create.description')}</>} />
      <form onSubmit={onSubmit} noValidate>
        <SectionCard
          title={tCommon('actions.details')}
          actions={
            <>
              <Link className="btn btn--outline" to={`${base}/assessments`}>
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
            <FormSelect
              id="cohort_id"
              label={t('instructorCreate.fields.cohort')}
              value={form.cohort_id}
              onChange={onCohortChange}
              error={errors.cohort_id}
            >
              <option value="">—</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </FormSelect>
            <FormDate
              id="due_date"
              label={t('table.dueDate')}
              value={form.due_date}
              onChange={(e) => setField('due_date', e.target.value)}
              error={errors.due_date}
            />
            <FormDate
              id="open_at"
              label={t('instructorCreate.fields.openDate')}
              value={form.open_at}
              onChange={(e) => setField('open_at', e.target.value)}
              error={errors.open_at}
            />
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
                  {o.outcome_code} — {o.outcome_text?.slice(0, 60)}
                </option>
              ))}
            </FormSelect>
            <FormSelect
              id="rubric_id"
              label={t('instructorCreate.fields.rubric')}
              value={form.rubric_id}
              onChange={(e) => setField('rubric_id', e.target.value)}
              error={errors.rubric_id}
            >
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
            <FormTextarea
              id="instructions"
              label={t('instructorCreate.fields.instructions')}
              value={form.instructions}
              onChange={(e) => setField('instructions', e.target.value)}
              error={errors.instructions}
              rows={4}
            />
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
