import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Lock, Sparkles, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/common/Button.jsx';
import { FormTextarea } from '../../components/forms/FormTextarea.jsx';
import { FileDropzone } from '../../components/forms/FileDropzone.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import {
  fetchOpportunityTasks,
  fetchStudentFieldTraining,
  runTaskAiSelfEvaluate,
  submitFieldTrainingTaskWithMeta,
} from '../../features/fieldTraining/fieldTraining.service.js';
import { fieldTrainingKeys } from '../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';
import { formatFtDate } from '../../features/fieldTraining/fieldTrainingUi.js';

const MIN_INPUT_LENGTH = 20;

export function StudentFieldTrainingSelfEvaluationPage() {
  const { opportunityId, taskId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation('fieldTraining');
  const { t: tUpload } = useTranslation('uploads');
  const qc = useQueryClient();
  const [studentInput, setStudentInput] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiMeta, setAiMeta] = useState(null);
  const [finalNotes, setFinalNotes] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');

  const tasksBackUrl = `/student/field-training/${opportunityId}?tab=tasks`;

  const { data: oppData, isLoading: oppLoading, isError: oppError } = useQuery({
    queryKey: fieldTrainingKeys.studentDetail(opportunityId),
    queryFn: () => fetchStudentFieldTraining(opportunityId),
    enabled: Boolean(opportunityId),
  });

  const { data: tasksData, isLoading: tasksLoading, isError: tasksError } = useQuery({
    queryKey: fieldTrainingKeys.tasks(opportunityId, 'student'),
    queryFn: () => fetchOpportunityTasks(opportunityId, { asAdmin: false }),
    enabled: Boolean(opportunityId),
  });

  const application = oppData?.application ?? null;
  const trainingStatus = application?.training_status ?? null;
  const expelled = trainingStatus === 'expelled' || Boolean(application?.expelled_at);
  const task = (tasksData?.tasks ?? []).find((x) => x.id === taskId);
  const requiresAi = Boolean(task?.requires_ai_self_evaluation);
  const submitted = Boolean(task?.submission);
  const inputValid = studentInput.trim().length >= MIN_INPUT_LENGTH;
  const isLoading = oppLoading || tasksLoading;

  const aiMut = useMutation({
    mutationFn: () => runTaskAiSelfEvaluate(taskId, studentInput.trim()),
    onSuccess: (res) => {
      setAiResponse(res.ai_response || '');
      setAiMeta(res);
      setError('');
    },
    onError: (err) => {
      const code = err?.response?.data?.code;
      if (code === 'AI_NOT_CONFIGURED') {
        setError(t('selfEval.aiNotConfigured'));
      } else if (code === 'AI_PROMPT_NOT_CONFIGURED') {
        setError(t('selfEval.aiPromptMissing'));
      } else if (code === 'AI_RATE_LIMIT') {
        setError(tUpload('ai.rateLimit'));
      } else if (code === 'AI_PROVIDER_ERROR' || code === 'AI_MODEL_UNSUPPORTED') {
        setError(t('selfEval.aiError'));
      } else {
        setError(getApiErrorMessage(err, t('selfEval.aiError')));
      }
    },
  });

  const submitMut = useMutation({
    mutationFn: () =>
      submitFieldTrainingTaskWithMeta(taskId, file, {
        student_self_evaluation_input: studentInput.trim(),
        ai_prompt_used: aiMeta?.ai_prompt_used,
        ai_model_provider: aiMeta?.ai_model_provider,
        ai_model_name: aiMeta?.ai_model_name,
        ai_raw_response: aiMeta?.ai_response,
        ai_response_inserted_text: aiResponse.trim(),
        final_student_notes: finalNotes.trim() || null,
      }),
    onSuccess: () => {
      setError('');
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.tasks(opportunityId, 'student') });
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.studentProgress(opportunityId) });
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.studentDetail(opportunityId) });
      navigate(tasksBackUrl, { replace: true, state: { taskSubmitted: true } });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  if (isLoading) {
    return (
      <div className="page page--student ft-page ft-self-eval">
        <LoadingSpinner />
      </div>
    );
  }

  if (oppError || tasksError) {
    return (
      <div className="page page--student ft-page ft-self-eval">
        <div className="ft-empty ft-empty--premium">
          <h3>{t('selfEval.loadError')}</h3>
          <Link className="btn btn--primary" to={tasksBackUrl}>
            {t('studentTraining.backToTasks')}
          </Link>
        </div>
      </div>
    );
  }

  if (expelled) {
    return (
      <div className="page page--student ft-page ft-self-eval">
        <div className="ft-panel-locked ft-panel-locked--premium" role="status">
          <Lock size={40} aria-hidden />
          <h3>{t('studentTraining.expelledTitle')}</h3>
          <p>{t('studentTraining.expelledText')}</p>
          <Link className="btn btn--outline" to={tasksBackUrl}>
            {t('studentTraining.backToTasks')}
          </Link>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="page page--student ft-page ft-self-eval">
        <div className="ft-empty ft-empty--premium">
          <h3>{t('selfEval.unauthorized')}</h3>
          <Link className="btn btn--primary" to={tasksBackUrl}>
            {t('studentTraining.backToTasks')}
          </Link>
        </div>
      </div>
    );
  }

  if (!requiresAi) {
    return (
      <div className="page page--student ft-page ft-self-eval">
        <div className="ft-empty ft-empty--premium">
          <p>{t('selfEval.notRequired')}</p>
          <Link className="btn btn--primary" to={tasksBackUrl}>
            {t('studentTraining.backToTasks')}
          </Link>
        </div>
      </div>
    );
  }

  if (submitted) {
    const reviewStatus = task.submission?.review_status;
    return (
      <div className="page page--student ft-page ft-self-eval">
        <Link to={tasksBackUrl} className="ft-detail-back">
          <ArrowLeft size={18} aria-hidden /> {t('backToOpportunity')}
        </Link>
        <header className="ft-self-eval__hero">
          <h1>{t('selfEval.title')}</h1>
        </header>
        <article className="ft-content-card ft-self-eval__card">
          <h2 className="ft-self-eval__task-title">{task.title || t('selfEval.fallbackTitle')}</h2>
          <StatusBadge variant="success">{t('tasks.submitted')}</StatusBadge>
          {task.submission?.submitted_at ? (
            <p className="ft-self-eval__meta">
              {t('studentTraining.submittedAt')}: {formatFtDate(task.submission.submitted_at)}
            </p>
          ) : null}
          {task.submission?.file_name ? (
            <p className="ft-self-eval__meta">
              {t('tasks.file')}: {task.submission.file_name}
            </p>
          ) : null}
          {reviewStatus ? (
            <p className="ft-self-eval__meta">
              {t('tasks.reviewStatus')}: {t(`tasks.reviewStatuses.${reviewStatus}`, reviewStatus)}
            </p>
          ) : null}
          {task.submission?.instructor_feedback ? (
            <div className="ft-self-eval__prompt">
              <strong>{t('tasks.instructorFeedback')}</strong>
              <p>{task.submission.instructor_feedback}</p>
            </div>
          ) : null}
          <Link className="btn btn--primary" to={tasksBackUrl}>
            {t('selfEval.viewSubmission')}
          </Link>
        </article>
      </div>
    );
  }

  return (
    <div className="page page--student ft-page ft-self-eval">
      <Link to={tasksBackUrl} className="ft-detail-back">
        <ArrowLeft size={18} aria-hidden /> {t('backToOpportunity')}
      </Link>

      <header className="ft-self-eval__hero">
        <h1>{t('selfEval.title')}</h1>
      </header>

      <article className="ft-content-card ft-self-eval__card ft-self-eval__summary">
        <div className="ft-self-eval__badges">
          {task.is_final_task ? (
            <StatusBadge variant="warning">{t('tasks.finalTaskBadge')}</StatusBadge>
          ) : null}
          <StatusBadge variant="info">
            <Sparkles size={12} aria-hidden /> {t('tasks.aiBadge')}
          </StatusBadge>
          <StatusBadge variant="warning">{t('tasks.pending')}</StatusBadge>
        </div>
        <h2 className="ft-self-eval__task-title">{task.title || t('selfEval.fallbackTitle')}</h2>
        <p className="ft-self-eval__desc">
          {task.description?.trim() || t('selfEval.fallbackDescription')}
        </p>
        <p className="ft-self-eval__meta">
          {t('tasks.dueDate')}:{' '}
          {task.due_date ? formatFtDate(task.due_date) : t('selfEval.noDueDate')}
        </p>
      </article>

      <article className="ft-content-card ft-self-eval__card">
        <h3 className="ft-self-eval__section-title">{t('selfEval.instructionsTitle')}</h3>
        <p className="ft-self-eval__desc">{t('selfEval.instructionsText')}</p>
        {task.ai_self_evaluation_prompt ? (
          <div className="ft-self-eval__prompt">
            <strong>{t('selfEval.instructorPrompt')}</strong>
            <p>{task.ai_self_evaluation_prompt}</p>
          </div>
        ) : null}
      </article>

      <form
        className="ft-self-eval__form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!file) {
            setError(t('selfEval.fileRequired'));
            return;
          }
          if (!inputValid) {
            setError(t('selfEval.inputTooShort', { min: MIN_INPUT_LENGTH }));
            return;
          }
          if (requiresAi && !aiResponse.trim()) {
            setError(t('selfEval.aiRequired'));
            return;
          }
          submitMut.mutate();
        }}
      >
        <article className="ft-content-card ft-self-eval__card">
          <FormTextarea
            label={t('selfEval.studentInputLabel')}
            placeholder={t('selfEval.studentInputPlaceholder')}
            value={studentInput}
            onChange={(e) => setStudentInput(e.target.value)}
            rows={5}
            required
          />
          {!inputValid && studentInput.trim().length > 0 ? (
            <p className="ft-self-eval__hint">{t('selfEval.inputTooShort', { min: MIN_INPUT_LENGTH })}</p>
          ) : null}

          <Button
            type="button"
            variant="outline"
            disabled={!inputValid || aiMut.isPending}
            onClick={() => aiMut.mutate()}
          >
            <Sparkles size={16} aria-hidden />
            {aiMut.isPending ? t('selfEval.aiLoading') : t('selfEval.runAi')}
          </Button>
        </article>

        <article className="ft-content-card ft-self-eval__card">
          <FormTextarea
            label={t('selfEval.aiResultLabel')}
            value={aiResponse}
            onChange={(e) => setAiResponse(e.target.value)}
            rows={6}
            placeholder={t('selfEval.aiResultPlaceholder')}
          />
          <p className="ft-self-eval__hint">{t('selfEval.aiReviewHint')}</p>
        </article>

        <article className="ft-content-card ft-self-eval__card">
          <FormTextarea
            label={t('selfEval.finalNotesLabel')}
            value={finalNotes}
            onChange={(e) => setFinalNotes(e.target.value)}
            rows={3}
          />

          <div className="ft-self-eval__upload">
            <span className="form-field__label">{t('selfEval.fileLabel')}</span>
            <FileDropzone
              disabled={submitMut.isPending}
              hint={t('tasks.dropzoneHint')}
              meta={t('tasks.dropzoneMeta')}
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              currentFileName={file?.name}
              onFile={setFile}
            />
          </div>
        </article>

        {error ? (
          <p className="form-field__error ft-self-eval__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="ft-self-eval__actions">
          <Button type="submit" variant="primary" disabled={submitMut.isPending}>
            <Upload size={16} aria-hidden />
            {submitMut.isPending ? t('selfEval.submitting') : t('selfEval.submit')}
          </Button>
        </div>
      </form>
    </div>
  );
}
