import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, ClipboardList, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../../components/common/LoadingSpinner.jsx';
import { FileDropzone } from '../../../../components/forms/FileDropzone.jsx';
import { StatusBadge } from '../../../../components/admin/StatusBadge.jsx';
import {
  useStudentOpportunityTasks,
  useSubmitFieldTrainingTask,
  downloadFieldTrainingSubmission,
  downloadTaskInstructionFile,
  saveFieldTrainingSubmissionBlob,
} from '../../../../features/fieldTraining/index.js';
import { StudentTaskInstructionSection } from '../../../student/fieldTraining/components/StudentTaskInstructionSection.jsx';
import { getApiErrorMessage } from '../../../../services/apiHelpers.js';
import { formatFtDate } from '../../../../features/fieldTraining/fieldTrainingUi.js';

export function StudentFieldTrainingTasksPanel({ opportunityId }) {
  const { t } = useTranslation('fieldTraining');
  const { t: tCommon } = useTranslation('common');
  const location = useLocation();
  const { data, isLoading, isError, refetch } = useStudentOpportunityTasks(opportunityId);
  const submitMut = useSubmitFieldTrainingTask(opportunityId);
  const [pendingFile, setPendingFile] = useState({});
  const [replacingId, setReplacingId] = useState(null);
  const [error, setError] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    if (location.state?.taskSubmitted) {
      setSubmitSuccess(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state?.taskSubmitted]);

  const tasks = data?.tasks ?? [];

  async function handleSubmit(taskId) {
    const file = pendingFile[taskId];
    if (!file) return;
    setError('');
    try {
      await submitMut.mutateAsync({ taskId, file });
      setPendingFile((p) => {
        const next = { ...p };
        delete next[taskId];
        return next;
      });
      setReplacingId(null);
      refetch();
    } catch (err) {
      setError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  async function handleDownloadInstruction(taskId) {
    setDownloadError('');
    try {
      const file = await downloadTaskInstructionFile(taskId, { asAdmin: false });
      if (file) saveFieldTrainingSubmissionBlob(file);
    } catch (err) {
      setDownloadError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  async function handleDownload(submissionId) {
    setDownloadError('');
    try {
      const file = await downloadFieldTrainingSubmission(submissionId, { asAdmin: false });
      if (file) saveFieldTrainingSubmissionBlob(file);
    } catch (err) {
      setDownloadError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  if (isLoading) return <LoadingSpinner />;
  if (isError) {
    return <p className="form-field__error">{t('studentTraining.loadError')}</p>;
  }

  if (!tasks.length) {
    return (
      <div className="ft-panel-locked ft-panel-locked--premium">
        <ClipboardList size={40} aria-hidden />
        <h3>{t('tasks.studentEmptyTitle')}</h3>
        <p>{t('studentTraining.noTasks')}</p>
      </div>
    );
  }

  return (
    <div className="ft-student-task-list">
      {submitSuccess ? (
        <p className="ft-student-task-list__success" role="status">
          {t('selfEval.submitSuccess')}
        </p>
      ) : null}
      {error ? (
        <p className="ft-student-task-list__error" role="alert">
          {error}
        </p>
      ) : null}
      {downloadError ? (
        <p className="ft-student-task-list__error" role="alert">
          {downloadError}
        </p>
      ) : null}
      {tasks.map((task, index) => {
        const submitted = Boolean(task.submission);
        const showUpload = !submitted || replacingId === task.id;
        const reviewStatus = task.submission?.review_status;

        return (
          <article key={task.id} className="ft-task-item ft-student-task-item">
            <div className="ft-task-item__index" aria-hidden>
              {index + 1}
            </div>
            <div className="ft-task-item__body">
              <header className="ft-task-item__head">
                <h3 className="ft-task-item__title">{task.title}</h3>
                <div className="ft-task-item__badges">
                  {task.is_final_task ? (
                    <StatusBadge variant="warning">{t('tasks.finalTaskBadge')}</StatusBadge>
                  ) : null}
                  {task.requires_ai_self_evaluation ? (
                    <StatusBadge variant="info">
                      <Sparkles size={12} aria-hidden /> {t('tasks.aiBadge')}
                    </StatusBadge>
                  ) : null}
                  {submitted ? (
                    <StatusBadge variant="success">{t('tasks.submitted')}</StatusBadge>
                  ) : (
                    <StatusBadge variant="warning">{t('tasks.pending')}</StatusBadge>
                  )}
                </div>
              </header>
              {task.description ? <p className="ft-task-item__desc">{task.description}</p> : null}

              <StudentTaskInstructionSection
                task={task}
                onDownload={() => handleDownloadInstruction(task.id)}
              />

              <div className="ft-task-item__meta">
                {task.due_date ? (
                  <span className="ft-task-item__badge">
                    <Calendar size={14} aria-hidden />
                    {t('tasks.dueDate')}: {formatFtDate(task.due_date)}
                  </span>
                ) : null}
              </div>

              {submitted && reviewStatus ? (
                <p className="ft-task-item__review">
                  {t('tasks.reviewStatus')}:{' '}
                  {t(`tasks.reviewStatuses.${reviewStatus}`, reviewStatus)}
                  {task.submission?.is_late ? ` · ${t('tasks.late')}` : ''}
                </p>
              ) : null}
              {submitted && task.submission?.instructor_feedback ? (
                <div className="ft-task-item__feedback">
                  <strong>{t('tasks.instructorFeedback')}</strong>
                  <p>{task.submission.instructor_feedback}</p>
                </div>
              ) : null}
              {submitted &&
              (task.submission?.ai_response_inserted_text ||
                task.submission?.student_self_evaluation_input) ? (
                <div className="ft-task-item__feedback ft-task-item__ai-summary">
                  {task.submission.student_self_evaluation_input ? (
                    <>
                      <strong>{t('selfEval.studentInputLabel')}</strong>
                      <p>{task.submission.student_self_evaluation_input}</p>
                    </>
                  ) : null}
                  {task.submission.ai_response_inserted_text ? (
                    <>
                      <strong>{t('selfEval.aiResultLabel')}</strong>
                      <p>{task.submission.ai_response_inserted_text}</p>
                    </>
                  ) : null}
                  {task.submission.final_student_notes ? (
                    <>
                      <strong>{t('selfEval.finalNotesLabel')}</strong>
                      <p>{task.submission.final_student_notes}</p>
                    </>
                  ) : null}
                </div>
              ) : null}

              {submitted && replacingId !== task.id ? (
                <div className="ft-task-card__submitted ft-student-task-item__submitted">
                  <span>
                    {t('tasks.file')}: {task.submission.file_name}
                  </span>
                  {task.submission?.id ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="btn--sm"
                      onClick={() => handleDownload(task.submission.id)}
                    >
                      {t('tasks.download')}
                    </Button>
                  ) : null}
                  {task.requires_ai_self_evaluation ? (
                    <Link
                      className="btn btn--outline btn--sm"
                      to={`/student/field-training/${opportunityId}/tasks/${task.id}/self-evaluation`}
                    >
                      {t('selfEval.viewSubmission')}
                    </Link>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="btn--sm"
                      onClick={() => {
                        setReplacingId(task.id);
                        setPendingFile((p) => ({ ...p, [task.id]: null }));
                      }}
                    >
                      {t('tasks.replaceFile')}
                    </Button>
                  )}
                </div>
              ) : null}

              {showUpload && task.requires_ai_self_evaluation ? (
                <Link
                  className="btn btn--primary"
                  to={`/student/field-training/${opportunityId}/tasks/${task.id}/self-evaluation`}
                >
                  {t('tasks.selfEvalLink')}
                </Link>
              ) : null}

              {showUpload && !task.requires_ai_self_evaluation ? (
                <div className="ft-task-card__upload ft-student-task-item__upload">
                  <FileDropzone
                    disabled={submitMut.isPending}
                    hint={t('tasks.dropzoneHint')}
                    meta={t('tasks.dropzoneMeta')}
                    accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                    currentFileName={pendingFile[task.id]?.name ?? task.submission?.file_name}
                    onFile={(file) => setPendingFile((p) => ({ ...p, [task.id]: file }))}
                  />
                  <Button
                    type="button"
                    variant="primary"
                    className="btn--sm"
                    disabled={!pendingFile[task.id] || submitMut.isPending}
                    onClick={() => handleSubmit(task.id)}
                  >
                    {submitMut.isPending ? t('tasks.uploading') : t('tasks.submit')}
                  </Button>
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
