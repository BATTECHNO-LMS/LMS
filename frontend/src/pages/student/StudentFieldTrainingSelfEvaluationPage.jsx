import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Sparkles, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/common/Button.jsx';
import { FormTextarea } from '../../components/forms/FormTextarea.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import {
  fetchOpportunityTasks,
  runTaskAiSelfEvaluate,
  submitFieldTrainingTaskWithMeta,
} from '../../features/fieldTraining/fieldTraining.service.js';
import { fieldTrainingKeys } from '../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';
import { formatFtDate } from '../../features/fieldTraining/fieldTrainingUi.js';

export function StudentFieldTrainingSelfEvaluationPage() {
  const { opportunityId, taskId } = useParams();
  const { t } = useTranslation('fieldTraining');
  const qc = useQueryClient();
  const [studentInput, setStudentInput] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiMeta, setAiMeta] = useState(null);
  const [finalNotes, setFinalNotes] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: fieldTrainingKeys.tasks(opportunityId, 'student'),
    queryFn: () => fetchOpportunityTasks(opportunityId, { asAdmin: false }),
    enabled: Boolean(opportunityId),
  });

  const task = (data?.tasks ?? []).find((x) => x.id === taskId);
  const requiresAi = Boolean(task?.requires_ai_self_evaluation);

  const aiMut = useMutation({
    mutationFn: () => runTaskAiSelfEvaluate(taskId, studentInput),
    onSuccess: (res) => {
      setAiResponse(res.ai_response || '');
      setAiMeta(res);
      setError('');
    },
    onError: (err) => {
      const code = err?.response?.data?.code;
      if (code === 'AI_NOT_CONFIGURED') {
        setError(t('selfEval.aiNotConfigured'));
      } else {
        setError(getApiErrorMessage(err, t('selfEval.aiError')));
      }
    },
  });

  const submitMut = useMutation({
    mutationFn: () =>
      submitFieldTrainingTaskWithMeta(taskId, file, {
        student_self_evaluation_input: studentInput,
        ai_prompt_used: aiMeta?.ai_prompt_used,
        ai_model_provider: aiMeta?.ai_model_provider,
        ai_model_name: aiMeta?.ai_model_name,
        ai_raw_response: aiMeta?.ai_response,
        ai_response_inserted_text: aiResponse,
        final_student_notes: finalNotes,
      }),
    onSuccess: () => {
      setSuccess(true);
      setError('');
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.tasks(opportunityId, 'student') });
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.studentProgress(opportunityId) });
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.studentDetail(opportunityId) });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  if (isLoading) return <LoadingSpinner />;
  if (!task) {
    return (
      <div className="page page--student ft-page">
        <p>{t('tasks.notFound')}</p>
        <Button as={Link} to={`/student/field-training/${opportunityId}`}>
          {t('backToOpportunity')}
        </Button>
      </div>
    );
  }

  return (
    <div className="page page--student ft-page ft-self-eval">
      <Link
        to={`/student/field-training/${opportunityId}?tab=tasks`}
        className="ft-detail-back"
      >
        <ArrowLeft size={18} aria-hidden /> {t('backToOpportunity')}
      </Link>

      <header className="ft-self-eval__hero">
        <h1>{t('selfEval.title')}</h1>
        <article className="ft-content-card ft-self-eval__summary">
          <h2 className="ft-self-eval__task-title">{task.title}</h2>
          {task.description ? <p className="ft-self-eval__desc">{task.description}</p> : null}
          {task.due_date ? (
            <p className="ft-self-eval__meta">
              {t('tasks.dueDate')}: {formatFtDate(task.due_date)}
            </p>
          ) : null}
          {task.ai_self_evaluation_prompt ? (
            <div className="ft-self-eval__prompt">
              <strong>{t('selfEval.instructorPrompt')}</strong>
              <p>{task.ai_self_evaluation_prompt}</p>
            </div>
          ) : null}
        </article>
      </header>

      {success ? (
        <div className="ft-empty ft-empty--premium" role="status">
          <h3>{t('selfEval.submitSuccess')}</h3>
          <Button
            as={Link}
            to={`/student/field-training/${opportunityId}?tab=tasks`}
            variant="primary"
          >
            {t('studentTraining.backToTasks')}
          </Button>
        </div>
      ) : (
        <form
          className="ft-self-eval__form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!file) {
              setError(t('selfEval.fileRequired'));
              return;
            }
            if (requiresAi && !aiResponse.trim()) {
              setError(t('selfEval.aiRequired'));
              return;
            }
            submitMut.mutate();
          }}
        >
          <FormTextarea
            label={t('selfEval.studentInputLabel')}
            placeholder={t('selfEval.studentInputPlaceholder')}
            value={studentInput}
            onChange={(e) => setStudentInput(e.target.value)}
            rows={5}
          />

          <Button
            type="button"
            variant="outline"
            disabled={!studentInput.trim() || aiMut.isPending}
            onClick={() => aiMut.mutate()}
          >
            <Sparkles size={16} aria-hidden />
            {aiMut.isPending ? t('selfEval.aiLoading') : t('selfEval.runAi')}
          </Button>

          <FormTextarea
            label={t('selfEval.aiResultLabel')}
            value={aiResponse}
            onChange={(e) => setAiResponse(e.target.value)}
            rows={6}
            placeholder={requiresAi ? t('selfEval.aiResultPlaceholder') : ''}
          />

          <FormTextarea
            label={t('selfEval.finalNotesLabel')}
            value={finalNotes}
            onChange={(e) => setFinalNotes(e.target.value)}
            rows={3}
          />

          <label className="form-field">
            <span className="form-field__label">{t('selfEval.fileLabel')}</span>
            <input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file ? (
              <span className="ft-self-eval__file-meta">
                {file.name} ({Math.round(file.size / 1024)} KB)
              </span>
            ) : null}
          </label>

          {error ? (
            <p className="form-field__error" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" variant="primary" disabled={submitMut.isPending}>
            <Upload size={16} aria-hidden />
            {submitMut.isPending ? t('selfEval.submitting') : t('selfEval.submit')}
          </Button>
        </form>
      )}
    </div>
  );
}
