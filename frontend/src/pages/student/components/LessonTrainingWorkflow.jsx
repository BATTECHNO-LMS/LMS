import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  FileText,
  Play,
  Upload,
  XCircle,
  ClipboardList,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { useLessonTraining, useLessonTrainingMutations } from '../../../features/courses/hooks/useLessonTraining.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

function embedVideoUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') && u.searchParams.get('v')) {
      return `https://www.youtube.com/embed/${u.searchParams.get('v')}`;
    }
    if (u.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
  } catch {
    return null;
  }
  return null;
}

function formatBytes(n) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function LessonTrainingWorkflow({ courseId, lesson, onFinished }) {
  const { t } = useTranslation('courses');
  const { t: tCommon } = useTranslation('common');
  const { data, isLoading, isError, error, refetch } = useLessonTraining(courseId, lesson?.id);
  const mut = useLessonTrainingMutations(courseId, lesson?.id);

  const [errorMsg, setErrorMsg] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [localAnswers, setLocalAnswers] = useState({});

  const config = data?.config;
  const workflow = data?.workflow;
  const embed = config?.video_url ? embedVideoUrl(config.video_url) : null;

  const step = workflow?.current_step ?? 1;
  const questions = config?.questions ?? [];

  useEffect(() => {
    if (workflow?.answers) setLocalAnswers(workflow.answers);
  }, [workflow?.answers]);

  // Opening a lesson creates enrollment server-side — refresh course progress/enrollment UI once
  const notifiedAccess = useRef(null);
  useEffect(() => {
    if (!data?.config || !lesson?.id) return;
    if (notifiedAccess.current === lesson.id) return;
    notifiedAccess.current = lesson.id;
    onFinished?.();
  }, [data?.config, lesson?.id, onFinished]);

  const answerList = useMemo(
    () =>
      questions.map((q) => ({
        question_id: q.id,
        answer_text: localAnswers[q.id] ?? '',
      })),
    [questions, localAnswers]
  );

  const run = useCallback(
    async (fn) => {
      setErrorMsg('');
      try {
        await fn();
        await refetch();
        onFinished?.();
      } catch (err) {
        setErrorMsg(getApiErrorMessage(err, tCommon('errors.generic')));
      }
    },
    [refetch, onFinished, tCommon]
  );

  async function onStart() {
    await run(() => mut.start.mutateAsync());
  }

  async function onUpload(file) {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setErrorMsg(t('training.pdfOnly'));
      return;
    }
    await run(() => mut.upload.mutateAsync(file));
  }

  async function onSubmitQuiz() {
    await run(() => mut.submitAnswers.mutateAsync(answerList));
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onUpload(file);
  }

  if (!lesson?.id) return null;
  if (isLoading) return <LoadingSpinner />;
  if (isError) {
    const status = error?.response?.status;
    const message = getApiErrorMessage(
      error,
      status === 403 ? t('student.lessonAccessDenied') : tCommon('errors.generic')
    );
    return (
      <div className="lesson-training__error-state">
        <p className="crud-muted" role="alert">
          {message}
        </p>
        <Button type="button" variant="outline" className="btn--sm" onClick={() => refetch()}>
          {t('structure.retry')}
        </Button>
      </div>
    );
  }

  const busy = mut.start.isPending || mut.upload.isPending || mut.submitAnswers.isPending;

  return (
    <div className="lesson-training">
      <nav className="lesson-training__steps" aria-label={t('training.stepsLabel')}>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <span
            key={n}
            className={`lesson-training__step${step >= n ? ' lesson-training__step--active' : ''}${step === n ? ' lesson-training__step--current' : ''}`}
          >
            {n}
          </span>
        ))}
      </nav>

      {errorMsg ? (
        <p className="lesson-training__error" role="alert">
          {errorMsg}
        </p>
      ) : null}

      {/* Step 1: Video + task */}
      <section className="lesson-training__block">
        <h3 className="lesson-training__block-title">
          <Play size={20} aria-hidden />
          {t('training.step1Title')}
        </h3>
        <div className="lesson-training__split">
          <div className="lesson-training__video">
            {embed ? (
              <div className="course-video-embed">
                <iframe title={config?.title} src={embed} allowFullScreen />
              </div>
            ) : (
              <p className="crud-muted">{t('training.noVideo')}</p>
            )}
          </div>
          <div className="lesson-training__task-card">
            <h4>{t('training.taskFile')}</h4>
            <p className="lesson-training__instructions">{config?.task_instructions}</p>
            {config?.task_file_url ? (
              <a
                className="btn btn--outline btn--sm"
                href={config.task_file_url}
                target="_blank"
                rel="noreferrer"
              >
                <FileText size={16} aria-hidden />
                {config.task_file_name || t('training.downloadTask')}
              </a>
            ) : (
              <p className="crud-muted">{t('training.noTaskFile')}</p>
            )}
            {!workflow?.started ? (
              <Button
                type="button"
                variant="primary"
                className="lesson-training__start-btn"
                disabled={busy}
                onClick={onStart}
              >
                {t('training.startTraining')}
              </Button>
            ) : (
              <p className="lesson-training__started">
                <CheckCircle2 size={18} aria-hidden />
                {t('training.started')}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Step 2: Upload */}
      {workflow?.started && !workflow?.finished ? (
        <section className="lesson-training__block">
          <h3 className="lesson-training__block-title">
            <Upload size={20} aria-hidden />
            {t('training.step2Title')}
          </h3>
          {!workflow?.submitted ? (
            <div
              className={`lesson-training__dropzone${dragOver ? ' lesson-training__dropzone--over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <p>{t('training.dropzoneHint')}</p>
              <p className="lesson-training__dropzone-meta">{t('training.dropzoneMeta')}</p>
              <label className="btn btn--primary">
                {t('training.uploadFile')}
                <input
                  type="file"
                  accept="application/pdf"
                  hidden
                  disabled={busy}
                  onChange={(e) => onUpload(e.target.files?.[0])}
                />
              </label>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Step 3: Uploaded confirmation */}
      {workflow?.submission ? (
        <section className="lesson-training__block lesson-training__block--success">
          <h3 className="lesson-training__block-title">
            <CheckCircle2 size={20} aria-hidden />
            {t('training.step3Title')}
          </h3>
          <div className="lesson-training__uploaded">
            <FileText size={28} aria-hidden />
            <div>
              <strong>{workflow.submission.file_name}</strong>
              <span>
                {formatBytes(workflow.submission.size_bytes)} · {t('training.uploadedAt')}{' '}
                {workflow.submission.submitted_at
                  ? new Date(workflow.submission.submitted_at).toLocaleString()
                  : ''}
              </span>
            </div>
          </div>
        </section>
      ) : null}

      {/* Step 4: Model answer + prompt */}
      {workflow?.submitted && !workflow?.finished ? (
        <section className="lesson-training__block">
          <h3 className="lesson-training__block-title">
            <Sparkles size={20} aria-hidden />
            {t('training.step4Title')}
          </h3>
          <div className="lesson-training__dual">
            <div>
              <h4>{t('training.modelAnswer')}</h4>
              {config?.model_answer_url ? (
                <a
                  className="btn btn--outline btn--sm"
                  href={config.model_answer_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {config.model_answer_name || t('training.downloadModel')}
                </a>
              ) : (
                <p className="crud-muted">{t('training.noModelAnswer')}</p>
              )}
            </div>
            <div>
              <h4>{t('training.correctionPrompt')}</h4>
              <pre className="lesson-training__prompt">{config?.correction_prompt}</pre>
            </div>
          </div>
        </section>
      ) : null}

      {/* Step 5: Quiz */}
      {workflow?.submitted && !workflow?.finished && questions.length > 0 ? (
        <section className="lesson-training__block">
          <h3 className="lesson-training__block-title">
            <ClipboardList size={20} aria-hidden />
            {t('training.step5Title')}
          </h3>
          <ol className="lesson-training__questions">
            {questions.map((q, idx) => (
              <li key={q.id} className="lesson-training__question">
                <div className="lesson-training__question-head">
                  <span>
                    {t('training.questionN', { n: idx + 1 })} · {q.points} {t('training.points')}
                  </span>
                </div>
                <p>{q.question_text}</p>
                {q.code_snippet ? (
                  <pre className="lesson-training__code">{q.code_snippet}</pre>
                ) : null}
                <textarea
                  className="lesson-training__answer-input"
                  rows={2}
                  value={localAnswers[q.id] ?? ''}
                  onChange={(e) =>
                    setLocalAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                  placeholder={t('training.answerPlaceholder')}
                />
              </li>
            ))}
          </ol>
          <Button type="button" variant="primary" disabled={busy} onClick={onSubmitQuiz}>
            {t('training.submitAnswers')}
          </Button>
        </section>
      ) : null}

      {workflow?.submitted && !workflow?.finished && questions.length === 0 ? (
        <section className="lesson-training__block">
          <Button type="button" variant="primary" disabled={busy} onClick={onSubmitQuiz}>
            {t('training.finishWithoutQuiz')}
          </Button>
        </section>
      ) : null}

      {/* Step 6: Results */}
      {workflow?.finished ? (
        <section className="lesson-training__block lesson-training__result">
          <h3 className="lesson-training__block-title">
            {workflow.passed ? (
              <CheckCircle2 size={22} className="lesson-training__icon-pass" aria-hidden />
            ) : (
              <XCircle size={22} className="lesson-training__icon-fail" aria-hidden />
            )}
            {t('training.step6Title')}
          </h3>
          <p className="lesson-training__score">
            {workflow.passed ? t('training.passed') : t('training.failed')} ·{' '}
            <strong>
              {workflow.total_score}/{config?.max_score ?? 100}
            </strong>
          </p>
          <pre className="lesson-training__feedback">{workflow.feedback_summary}</pre>
          {workflow.correction_details ? (
            <details className="lesson-training__details">
              <summary>{t('training.viewCorrectionDetails')}</summary>
              <pre>{workflow.correction_details}</pre>
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
