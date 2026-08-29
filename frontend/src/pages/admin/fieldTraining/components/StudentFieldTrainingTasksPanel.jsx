import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, ClipboardList, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../../components/common/LoadingSpinner.jsx';
import { FileDropzone } from '../../../../components/forms/FileDropzone.jsx';
import { FormTextarea } from '../../../../components/forms/FormTextarea.jsx';
import { FormInput } from '../../../../components/forms/FormInput.jsx';
import { StatusBadge } from '../../../../components/admin/StatusBadge.jsx';
import {
  useStudentOpportunityTasks,
  useSubmitFieldTrainingTask,
  downloadFieldTrainingSubmission,
  downloadTaskInstructionFile,
  saveFieldTrainingSubmissionBlob,
  submitFieldTrainingTaskWithMeta,
} from '../../../../features/fieldTraining/index.js';
import { StudentTaskInstructionSection } from '../../../student/fieldTraining/components/StudentTaskInstructionSection.jsx';
import { getApiErrorMessage } from '../../../../services/apiHelpers.js';
import { formatFtDate } from '../../../../features/fieldTraining/fieldTrainingUi.js';
import {
  GRADING_MODES,
  resolveTaskGradingMode,
  gradingModeLabelKey,
  SUBMISSION_ACCEPT_ALL,
} from '../../../../features/fieldTraining/fieldTrainingGrading.js';
import { useQueryClient } from '@tanstack/react-query';
import { fieldTrainingKeys } from '../../../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';

export function StudentFieldTrainingTasksPanel({ opportunityId }) {
  const { t } = useTranslation('fieldTraining');
  const { t: tCommon } = useTranslation('common');
  const location = useLocation();
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useStudentOpportunityTasks(opportunityId);
  const submitMut = useSubmitFieldTrainingTask(opportunityId);
  const [pendingFiles, setPendingFiles] = useState({});
  const [solutionNotes, setSolutionNotes] = useState({});
  const [projectUrls, setProjectUrls] = useState({});
  const [uploadProgress, setUploadProgress] = useState({});
  const [replacingId, setReplacingId] = useState(null);
  const [error, setError] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submittingTaskId, setSubmittingTaskId] = useState(null);

  useEffect(() => {
    if (location.state?.taskSubmitted) {
      setSubmitSuccess(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state?.taskSubmitted]);

  const tasks = data?.tasks ?? [];

  async function handleSubmit(taskId, gradingMode) {
    const files = pendingFiles[taskId] || [];
    const notes = (solutionNotes[taskId] || '').trim();
    const projectUrl = (projectUrls[taskId] || '').trim() || null;
    if (!files.length && !notes && !projectUrl) return;
    if (submittingTaskId) return;
    setError('');
    setSubmittingTaskId(taskId);
    try {
      await submitFieldTrainingTaskWithMeta(taskId, files, {
        accept: SUBMISSION_ACCEPT_ALL,
        maxBytes: 100 * 1024 * 1024,
        solution_notes: notes || null,
        final_student_notes: notes || null,
        project_url: projectUrl,
        onProgress: (percent) => setUploadProgress((p) => ({ ...p, [taskId]: percent })),
      });
      setPendingFiles((p) => {
        const next = { ...p };
        delete next[taskId];
        return next;
      });
      setSolutionNotes((p) => {
        const next = { ...p };
        delete next[taskId];
        return next;
      });
      setProjectUrls((p) => {
        const next = { ...p };
        delete next[taskId];
        return next;
      });
      setUploadProgress((p) => {
        const next = { ...p };
        delete next[taskId];
        return next;
      });
      setReplacingId(null);
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.tasks(opportunityId, 'student') });
      refetch();
      setSubmitSuccess(true);
    } catch (err) {
      if (err?.code === 'TOO_LARGE') {
        setError(t('tasks.fileTooLarge'));
      } else {
        setError(getApiErrorMessage(err, tCommon('errors.generic')));
      }
    } finally {
      setSubmittingTaskId(null);
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
        const gradingMode = resolveTaskGradingMode(task);
        const files = pendingFiles[task.id] || [];
        const busy = submittingTaskId === task.id || submitMut.isPending;

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
                  <StatusBadge variant={task.is_required === false ? 'muted' : 'warning'}>
                    {task.is_required === false ? t('tasks.optionalBadge') : t('tasks.requiredBadge')}
                  </StatusBadge>
                  <StatusBadge variant="info">
                    {gradingMode === GRADING_MODES.AI ? <Sparkles size={12} aria-hidden /> : null}{' '}
                    {t(gradingModeLabelKey(gradingMode))}
                  </StatusBadge>
                  {submitted ? (
                    <StatusBadge variant="success">{t('tasks.submitted')}</StatusBadge>
                  ) : (
                    <StatusBadge variant="warning">{t('tasks.pending')}</StatusBadge>
                  )}
                </div>
              </header>
              {task.description ? <p className="ft-task-item__desc">{task.description}</p> : null}
              {gradingMode === GRADING_MODES.NONE ? (
                <p className="ft-task-item__desc" role="note">
                  {t('tasks.noGradingNotice')}
                </p>
              ) : null}

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
                  {task.submission?.manual_score != null
                    ? ` · ${t('tasks.manualScore')}: ${task.submission.manual_score}`
                    : ''}
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
                </div>
              ) : null}

              {submitted && replacingId !== task.id ? (
                <div className="ft-task-card__submitted ft-student-task-item__submitted">
                  <span>
                    {task.submission.files?.length
                      ? t('tasks.filesCount', { count: task.submission.files.length })
                      : `${t('tasks.file')}: ${task.submission.file_name || '—'}`}
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
                  {gradingMode === GRADING_MODES.AI ? (
                    <Link
                      className="btn btn--outline btn--sm"
                      to={`/student/field-training/${opportunityId}/tasks/${task.id}/self-evaluation`}
                    >
                      {t('selfEval.viewSubmission')}
                    </Link>
                  ) : reviewStatus === 'needs_revision' ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="btn--sm"
                      onClick={() => {
                        setReplacingId(task.id);
                        setPendingFiles((p) => ({ ...p, [task.id]: [] }));
                      }}
                    >
                      {t('tasks.replaceFile')}
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {showUpload && gradingMode === GRADING_MODES.AI ? (
                <Link
                  className="btn btn--primary"
                  to={`/student/field-training/${opportunityId}/tasks/${task.id}/self-evaluation`}
                >
                  {t('tasks.selfEvalLink')}
                </Link>
              ) : null}

              {showUpload && gradingMode !== GRADING_MODES.AI ? (
                <div className="ft-task-card__upload ft-student-task-item__upload">
                  <FormTextarea
                    label={t('tasks.solutionNotes')}
                    value={solutionNotes[task.id] || ''}
                    onChange={(e) =>
                      setSolutionNotes((p) => ({ ...p, [task.id]: e.target.value }))
                    }
                    rows={3}
                  />
                  <FormInput
                    label={t('selfEval.projectUrl')}
                    value={projectUrls[task.id] || ''}
                    onChange={(e) => setProjectUrls((p) => ({ ...p, [task.id]: e.target.value }))}
                    placeholder="https://"
                  />
                  <FileDropzone
                    disabled={busy}
                    multiple
                    hint={t('tasks.dropzoneHint')}
                    meta={t('tasks.dropzoneMeta')}
                    accept={SUBMISSION_ACCEPT_ALL}
                    currentFileName={
                      files.length
                        ? files.map((f) => f.name).join(', ')
                        : task.submission?.file_name
                    }
                    onFile={(file) => {
                      if (!file) return;
                      setPendingFiles((p) => ({
                        ...p,
                        [task.id]: [...(p[task.id] || []), file].slice(0, 10),
                      }));
                    }}
                  />
                  {files.length ? (
                    <ul className="ft-student-task-item__file-list">
                      {files.map((f, i) => (
                        <li key={`${f.name}-${i}`}>
                          {f.name} ({Math.round(f.size / 1024)} KB)
                          <Button
                            type="button"
                            variant="outline"
                            className="btn--sm"
                            onClick={() =>
                              setPendingFiles((p) => ({
                                ...p,
                                [task.id]: (p[task.id] || []).filter((_, idx) => idx !== i),
                              }))
                            }
                          >
                            {tCommon('actions.delete') || 'حذف'}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {uploadProgress[task.id] != null ? (
                    <p role="status">
                      {t('tasks.uploadProgress', { percent: uploadProgress[task.id] })}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    variant="primary"
                    className="btn--sm"
                    disabled={
                      busy ||
                      (!files.length &&
                        !(solutionNotes[task.id] || '').trim() &&
                        !(projectUrls[task.id] || '').trim())
                    }
                    onClick={() => handleSubmit(task.id, gradingMode)}
                  >
                    {busy ? t('tasks.uploading') : t('tasks.submit')}
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
