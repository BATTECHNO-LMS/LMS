import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ClipboardList } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../../components/common/LoadingSpinner.jsx';
import { FileDropzone } from '../../../../components/forms/FileDropzone.jsx';
import { StatusBadge } from '../../../../components/admin/StatusBadge.jsx';
import {
  useStudentOpportunityTasks,
  useSubmitFieldTrainingTask,
  downloadFieldTrainingSubmission,
  saveFieldTrainingSubmissionBlob,
} from '../../../../features/fieldTraining/index.js';
import { getApiErrorMessage } from '../../../../services/apiHelpers.js';
import { formatFtDate } from '../../../../features/fieldTraining/fieldTrainingUi.js';

export function StudentFieldTrainingTasksPanel({ opportunityId }) {
  const { t } = useTranslation('fieldTraining');
  const { t: tCommon } = useTranslation('common');
  const { data, isLoading, refetch } = useStudentOpportunityTasks(opportunityId);
  const submitMut = useSubmitFieldTrainingTask(opportunityId);
  const [pendingFile, setPendingFile] = useState({});
  const [replacingId, setReplacingId] = useState(null);
  const [error, setError] = useState('');
  const [downloadError, setDownloadError] = useState('');

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

  async function handleDownload(submissionId) {
    setDownloadError('');
    try {
      const file = await downloadFieldTrainingSubmission(submissionId, { asAdmin: false });
      saveFieldTrainingSubmissionBlob(file);
    } catch (err) {
      setDownloadError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  if (isLoading) return <LoadingSpinner />;

  if (!tasks.length) {
    return (
      <div className="ft-panel-locked ft-panel-locked--premium">
        <ClipboardList size={40} aria-hidden />
        <h3>{t('tasks.studentEmptyTitle')}</h3>
        <p>{t('tasks.studentEmptyDesc')}</p>
      </div>
    );
  }

  return (
    <div className="ft-student-task-list">
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
        return (
          <article key={task.id} className="ft-task-item ft-student-task-item">
            <div className="ft-task-item__index" aria-hidden>
              {index + 1}
            </div>
            <div className="ft-task-item__body">
              <header className="ft-task-item__head">
                <h3 className="ft-task-item__title">{task.title}</h3>
                {submitted ? (
                  <StatusBadge variant="success">{t('tasks.submitted')}</StatusBadge>
                ) : (
                  <StatusBadge variant="warning">{t('tasks.pending')}</StatusBadge>
                )}
              </header>
              {task.description ? <p className="ft-task-item__desc">{task.description}</p> : null}
              <div className="ft-task-item__meta">
                {task.due_date ? (
                  <span className="ft-task-item__badge">
                    <Calendar size={14} aria-hidden />
                    {t('tasks.dueDate')}: {formatFtDate(task.due_date)}
                  </span>
                ) : null}
              </div>

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
                </div>
              ) : null}

              {showUpload && task.requires_ai_self_evaluation ? (
                <Button as={Link} to={`/student/field-training/${opportunityId}/tasks/${task.id}/self-evaluation`} variant="primary">
                  {t('tasks.selfEvalLink')}
                </Button>
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
