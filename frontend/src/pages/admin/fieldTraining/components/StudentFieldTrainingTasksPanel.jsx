import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
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
      <div className="ft-panel-locked">
        <ClipboardList size={40} aria-hidden />
        <h3>{t('tasks.studentEmptyTitle')}</h3>
        <p>{t('tasks.studentEmptyDesc')}</p>
      </div>
    );
  }

  return (
    <div>
      {error ? (
        <p className="form-field__error" role="alert" style={{ marginBottom: '0.75rem' }}>
          {error}
        </p>
      ) : null}
      {downloadError ? (
        <p className="form-field__error" role="alert" style={{ marginBottom: '0.75rem' }}>
          {downloadError}
        </p>
      ) : null}
      {tasks.map((task, index) => {
        const submitted = Boolean(task.submission);
        const showUpload = !submitted || replacingId === task.id;
        return (
          <article key={task.id} className="ft-task-card">
            <header className="ft-task-card__head">
              <div>
                <h3 className="ft-task-card__title">
                  {index + 1}. {task.title}
                </h3>
                {task.description ? <p className="crud-muted">{task.description}</p> : null}
                {task.due_date ? (
                  <p className="crud-muted">
                    {t('tasks.dueDate')}: {formatFtDate(task.due_date)}
                  </p>
                ) : null}
              </div>
              {submitted ? (
                <StatusBadge variant="success">{t('tasks.submitted')}</StatusBadge>
              ) : (
                <StatusBadge variant="warning">{t('tasks.pending')}</StatusBadge>
              )}
            </header>

            {submitted && replacingId !== task.id ? (
              <div className="ft-task-card__submitted">
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

            {showUpload ? (
              <div className="ft-task-card__upload">
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
          </article>
        );
      })}
    </div>
  );
}
