import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  FileText,
  Link2,
  Lock,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/common/Button.jsx';
import { FormTextarea } from '../../components/forms/FormTextarea.jsx';
import { FileDropzone } from '../../components/forms/FileDropzone.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import { PagePermissionGate } from '../../components/permissions/PagePermissionGate.jsx';
import { UI_PERMISSION } from '../../constants/permissions.js';
import {
  fetchOpportunityTasks,
  fetchStudentFieldTraining,
  runTaskAiSelfEvaluate,
  submitFieldTrainingTaskWithMeta,
  downloadTaskInstructionFile,
  fetchAiSupportedSubmissionFileTypes,
} from '../../features/fieldTraining/fieldTraining.service.js';
import { saveFieldTrainingSubmissionBlob } from '../../features/fieldTraining/fieldTrainingDownload.js';
import { fieldTrainingKeys } from '../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';
import { uploadFileToStorage } from '../../features/uploads/uploadFileToStorage.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';
import { formatFtDate } from '../../features/fieldTraining/fieldTrainingUi.js';
import { StudentTaskInstructionSection } from './fieldTraining/components/StudentTaskInstructionSection.jsx';
import {
  GRADING_MODES,
  resolveTaskGradingMode,
  gradingModeLabelKey,
  SUBMISSION_ACCEPT_ALL,
} from '../../features/fieldTraining/fieldTrainingGrading.js';

const MIN_INPUT_LENGTH = 20;
const MAX_INPUT_LENGTH = 20000;

function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(Number(bytes))) return '';
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isValidHttpUrl(value) {
  try {
    const u = new URL(String(value || '').trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function resolveHttpErrorMessage(err, t, fallbackKey = 'selfEval.loadError') {
  const status = err?.response?.status;
  const code = err?.response?.data?.code;
  if (status === 403 || code === 'FIELD_TRAINING_NOT_ELIGIBLE') {
    return t('selfEval.unauthorized');
  }
  if (status === 404) return t('selfEval.notFound');
  if (status >= 500) return t('selfEval.serverError');
  if (code === 'CONTENT_UNREADABLE') {
    return err?.response?.data?.message || t('selfEval.contentUnreadable');
  }
  return getApiErrorMessage(err, t(fallbackKey));
}

export function StudentFieldTrainingSelfEvaluationPage() {
  const { opportunityId, taskId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation('fieldTraining');
  const { t: tUpload } = useTranslation('uploads');
  const qc = useQueryClient();

  const [studentDescription, setStudentDescription] = useState('');
  const [projectUrl, setProjectUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [files, setFiles] = useState([]);
  const [uploadedFileIds, setUploadedFileIds] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [archiveWarning, setArchiveWarning] = useState('');

  const [aiResponse, setAiResponse] = useState('');
  const [aiMeta, setAiMeta] = useState(null);
  const [finalNotes, setFinalNotes] = useState('');
  const [error, setError] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [downloadingInstruction, setDownloadingInstruction] = useState(false);

  const tasksBackUrl = `/student/field-training/${opportunityId}?tab=tasks`;

  const {
    data: oppData,
    isLoading: oppLoading,
    isError: oppError,
    error: oppErr,
  } = useQuery({
    queryKey: fieldTrainingKeys.studentDetail(opportunityId),
    queryFn: () => fetchStudentFieldTraining(opportunityId),
    enabled: Boolean(opportunityId),
  });

  const {
    data: tasksData,
    isLoading: tasksLoading,
    isError: tasksError,
    error: tasksErr,
  } = useQuery({
    queryKey: fieldTrainingKeys.tasks(opportunityId, 'student'),
    queryFn: () => fetchOpportunityTasks(opportunityId, { asAdmin: false }),
    enabled: Boolean(opportunityId),
  });

  const application = oppData?.application ?? null;
  const trainingStatus = application?.training_status ?? null;
  const expelled = trainingStatus === 'expelled' || Boolean(application?.expelled_at);
  const task = (tasksData?.tasks ?? []).find((x) => x.id === taskId);
  const gradingMode = resolveTaskGradingMode(task);
  const requiresAi = gradingMode === GRADING_MODES.AI;
  const submitted = Boolean(task?.submission);
  const trimmedDescription = studentDescription.trim();
  const inputValid =
    trimmedDescription.length >= MIN_INPUT_LENGTH && trimmedDescription.length <= MAX_INPUT_LENGTH;
  const urlTrimmed = projectUrl.trim();
  const hasUrl = Boolean(urlTrimmed);
  const hasFileSource = Boolean(files.length || uploadedFileIds.length);
  const hasAnalyzableSource = hasFileSource || hasUrl;
  const aiReady = Boolean(aiMeta && aiResponse.trim());
  const isLoading = oppLoading || tasksLoading;
  const isForbidden =
    oppError &&
    (oppErr?.response?.status === 403 ||
      oppErr?.response?.data?.code === 'FIELD_TRAINING_NOT_ELIGIBLE');

  const { data: aiFileTypes } = useQuery({
    queryKey: ['field-training', 'ai-supported-file-types'],
    queryFn: fetchAiSupportedSubmissionFileTypes,
    staleTime: 5 * 60 * 1000,
    enabled: requiresAi,
  });

  const aiMut = useMutation({
    mutationFn: async () => {
      let ids = [...uploadedFileIds];
      if (files.length) {
        setUploading(true);
        setUploadProgress(0);
        setArchiveWarning('');
        try {
          for (const f of files) {
            const record = await uploadFileToStorage(f, {
              folder: 'training',
              visibility: 'private',
              accept: SUBMISSION_ACCEPT_ALL,
              maxBytes: aiFileTypes?.maxFileSize || 100 * 1024 * 1024,
              relatedEntityType: 'field_training_task',
              relatedEntityId: taskId,
              onProgress: setUploadProgress,
            });
            ids.push(record.id);
            const name = String(f.name || '').toLowerCase();
            if (/\.(zip|rar|7z|tar|gz|tgz)$/.test(name)) {
              setArchiveWarning(t('tasks.archiveAiWarning'));
            }
          }
          ids = [...new Set(ids)];
          setUploadedFileIds(ids);
          setFiles([]);
        } finally {
          setUploading(false);
          setUploadProgress(null);
        }
      }
      return runTaskAiSelfEvaluate(taskId, {
        studentDescription: trimmedDescription,
        uploadedFileId: ids[0] || null,
        uploadedFileIds: ids,
        projectUrl: urlTrimmed || null,
      });
    },
    onSuccess: (res) => {
      setAiResponse(res.ai_response || '');
      setAiMeta(res);
      setError('');
      if (res.warnings?.length) {
        const archiveMsg = res.warnings.find((w) => /مضغوط|archive/i.test(String(w)));
        if (archiveMsg) setArchiveWarning(archiveMsg);
      }
    },
    onError: (err) => {
      const code = err?.response?.data?.code;
      if (code === 'AI_NOT_CONFIGURED') setError(t('selfEval.aiNotConfigured'));
      else if (code === 'AI_PROMPT_NOT_CONFIGURED') setError(t('selfEval.aiPromptMissing'));
      else if (code === 'AI_RATE_LIMIT') setError(tUpload('ai.rateLimit'));
      else if (code === 'AI_PROVIDER_ERROR' || code === 'AI_MODEL_UNSUPPORTED') {
        setError(t('selfEval.aiError'));
      } else setError(resolveHttpErrorMessage(err, t, 'selfEval.aiError'));
    },
  });

  const submitMut = useMutation({
    mutationFn: () =>
      submitFieldTrainingTaskWithMeta(taskId, files.length ? files : null, {
        accept: SUBMISSION_ACCEPT_ALL,
        maxBytes: aiFileTypes?.maxFileSize || 100 * 1024 * 1024,
        fileIds: uploadedFileIds,
        fileId: uploadedFileIds[0] || undefined,
        analysis_file_id: uploadedFileIds[0] || aiMeta?.analysis_file_id || undefined,
        project_url: urlTrimmed || aiMeta?.project_url || null,
        student_self_evaluation_input: trimmedDescription,
        ai_prompt_used: aiMeta?.ai_prompt_used,
        ai_model_provider: aiMeta?.ai_model_provider,
        ai_model_name: aiMeta?.ai_model_name,
        ai_raw_response: aiMeta?.ai_response,
        ai_response_inserted_text: aiResponse.trim(),
        final_student_notes: finalNotes.trim() || null,
        file_extraction_status: aiMeta?.file_extraction_status ?? null,
        file_extracted_text: aiMeta?.file_extracted_text ?? null,
        url_extraction_status: aiMeta?.url_extraction_status ?? null,
        url_extracted_text: aiMeta?.url_extracted_text ?? null,
        extraction_errors: aiMeta?.extraction_errors ?? null,
        ai_evaluated_at: aiMeta?.evaluated_at ?? new Date().toISOString(),
      }),
    onSuccess: () => {
      setError('');
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.tasks(opportunityId, 'student') });
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.studentProgress(opportunityId) });
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.studentDetail(opportunityId) });
      navigate(tasksBackUrl, { replace: true, state: { taskSubmitted: true } });
    },
    onError: (err) => {
      setError(resolveHttpErrorMessage(err, t, 'selfEval.submitError'));
    },
  });

  const busy = aiMut.isPending || submitMut.isPending || uploading;
  const canAnalyze = inputValid && hasAnalyzableSource && !busy && !urlError;
  const canSubmit = inputValid && aiReady && hasAnalyzableSource && !busy;

  async function handleDownloadInstruction() {
    setDownloadError('');
    setDownloadingInstruction(true);
    try {
      const downloaded = await downloadTaskInstructionFile(taskId, { asAdmin: false });
      if (downloaded) saveFieldTrainingSubmissionBlob(downloaded);
    } catch (err) {
      setDownloadError(resolveHttpErrorMessage(err, t, 'student.fileForbidden'));
    } finally {
      setDownloadingInstruction(false);
    }
  }

  function clearAiState() {
    setAiMeta(null);
  }

  function handleDescriptionChange(value) {
    setStudentDescription(value);
    if (aiMeta) clearAiState();
  }

  function handleUrlChange(value) {
    setProjectUrl(value);
    if (!value.trim()) setUrlError('');
    else if (!isValidHttpUrl(value)) setUrlError(t('selfEval.urlInvalid'));
    else setUrlError('');
    if (aiMeta) clearAiState();
  }

  function handleFilePick(nextFile) {
    if (!nextFile) return;
    setFiles((prev) => [...prev, nextFile].slice(0, 10));
    const name = String(nextFile.name || '').toLowerCase();
    if (/\.(zip|rar|7z|tar|gz|tgz)$/.test(name)) {
      setArchiveWarning(t('tasks.archiveAiWarning'));
    }
    if (aiMeta) clearAiState();
  }

  function handleRemoveFile(index) {
    if (typeof index === 'number') {
      setFiles((prev) => prev.filter((_, i) => i !== index));
    } else {
      setFiles([]);
      setUploadedFileIds([]);
    }
    setUploadProgress(null);
    if (aiMeta) clearAiState();
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!inputValid) {
      setError(t('selfEval.inputTooShort', { min: MIN_INPUT_LENGTH }));
      return;
    }
    if (!hasAnalyzableSource) {
      setError(t('selfEval.sourceRequired'));
      return;
    }
    if (hasUrl && !isValidHttpUrl(urlTrimmed)) {
      setUrlError(t('selfEval.urlInvalid'));
      setError(t('selfEval.urlInvalid'));
      return;
    }
    if (!aiReady) {
      setError(t('selfEval.aiRequired'));
      return;
    }
    if (submitMut.isPending) return;
    submitMut.mutate();
  }

  function wrap(content) {
    return (
      <PagePermissionGate permission={UI_PERMISSION.canViewFieldTraining}>
        <div className="page page--student ft-page ft-self-eval">{content}</div>
      </PagePermissionGate>
    );
  }

  function renderHeaderCard({ statusBadge }) {
    return (
      <header className="ft-self-eval__header-card">
        <Link to={tasksBackUrl} className="ft-self-eval__back">
          <ArrowLeft size={18} aria-hidden />
          {t('studentTraining.backToTasks')}
        </Link>
        <div className="ft-self-eval__header-main">
          <h1 className="ft-self-eval__page-title">{t('selfEval.title')}</h1>
          <p className="ft-self-eval__task-name">{task?.title || t('selfEval.fallbackTitle')}</p>
          <div className="ft-self-eval__header-meta">
            {statusBadge}
            <span className="ft-self-eval__meta-chip">
              <Calendar size={14} aria-hidden />
              {t('tasks.dueDate')}:{' '}
              {task?.due_date ? formatFtDate(task.due_date) : t('selfEval.noDueDate')}
            </span>
            <StatusBadge variant="info">
              <Sparkles size={12} aria-hidden />
              {t(gradingModeLabelKey(gradingMode))}
            </StatusBadge>
          </div>
        </div>
      </header>
    );
  }

  if (isLoading) return wrap(<LoadingSpinner />);

  if (isForbidden) {
    return wrap(
      <div className="ft-empty ft-empty--premium" role="alert">
        <h3>{t('student.notEligibleTitle')}</h3>
        <p>{t('student.notEligibleDesc')}</p>
        <Link className="btn btn--primary" to="/student/field-training">
          {t('student.backToList')}
        </Link>
      </div>
    );
  }

  if (oppError || tasksError) {
    return wrap(
      <div className="ft-empty ft-empty--premium" role="alert">
        <h3>{resolveHttpErrorMessage(oppErr || tasksErr, t)}</h3>
        <Link className="btn btn--primary" to={tasksBackUrl}>
          {t('studentTraining.backToTasks')}
        </Link>
      </div>
    );
  }

  if (expelled) {
    return wrap(
      <div className="ft-panel-locked ft-panel-locked--premium" role="status">
        <Lock size={40} aria-hidden />
        <h3>{t('studentTraining.expelledTitle')}</h3>
        <p>{t('studentTraining.expelledText')}</p>
        <Link className="btn btn--outline" to={tasksBackUrl}>
          {t('studentTraining.backToTasks')}
        </Link>
      </div>
    );
  }

  if (!task) {
    return wrap(
      <div className="ft-empty ft-empty--premium" role="alert">
        <h3>{t('selfEval.notFound')}</h3>
        <Link className="btn btn--primary" to={tasksBackUrl}>
          {t('studentTraining.backToTasks')}
        </Link>
      </div>
    );
  }

  if (!requiresAi) {
    return wrap(
      <div className="ft-empty ft-empty--premium">
        <p>{t('selfEval.notRequired')}</p>
        <Link className="btn btn--primary" to={tasksBackUrl}>
          {t('studentTraining.backToTasks')}
        </Link>
      </div>
    );
  }

  if (submitted) {
    const reviewStatus = task.submission?.review_status;
    return wrap(
      <>
        {renderHeaderCard({
          statusBadge: <StatusBadge variant="success">{t('tasks.submitted')}</StatusBadge>,
        })}
        <article className="ft-self-eval__card ft-self-eval__card--white">
          <div className="ft-self-eval__badges">
            {task.submission?.is_late ? (
              <StatusBadge variant="warning">{t('tasks.late')}</StatusBadge>
            ) : (
              <StatusBadge variant="info">{t('tasks.onTime')}</StatusBadge>
            )}
            {reviewStatus ? (
              <StatusBadge variant={reviewStatus === 'approved' ? 'success' : 'warning'}>
                {t(`tasks.reviewStatuses.${reviewStatus}`, reviewStatus)}
              </StatusBadge>
            ) : null}
          </div>
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
          {task.submission?.project_url ? (
            <p className="ft-self-eval__meta">
              {t('selfEval.projectUrl')}:{' '}
              <a href={task.submission.project_url} target="_blank" rel="noreferrer">
                {task.submission.project_url}
              </a>
            </p>
          ) : null}
          {task.submission?.instructor_feedback ? (
            <div className="ft-self-eval__info-card">
              <strong>{t('tasks.instructorFeedback')}</strong>
              <p>{task.submission.instructor_feedback}</p>
            </div>
          ) : null}
          {task.submission?.student_self_evaluation_input ? (
            <div className="ft-self-eval__block">
              <strong>{t('selfEval.studentInputLabel')}</strong>
              <p>{task.submission.student_self_evaluation_input}</p>
            </div>
          ) : null}
          {task.submission?.ai_response_inserted_text ? (
            <div className="ft-self-eval__ai-result">
              <strong>{t('selfEval.aiResultLabel')}</strong>
              <p>{task.submission.ai_response_inserted_text}</p>
            </div>
          ) : null}
          <div className="ft-self-eval__actions">
            <Link className="btn btn--primary" to={tasksBackUrl}>
              {t('studentTraining.backToTasks')}
            </Link>
          </div>
        </article>
      </>
    );
  }

  return wrap(
    <>
      {renderHeaderCard({
        statusBadge: <StatusBadge variant="warning">{t('tasks.pending')}</StatusBadge>,
      })}

      <article className="ft-self-eval__card ft-self-eval__card--white ft-self-eval__summary">
        <h2 className="ft-self-eval__task-title">{task.title || t('selfEval.fallbackTitle')}</h2>
        <div className="ft-self-eval__text-block">
          <h3 className="ft-self-eval__label">{t('form.description')}</h3>
          <p className="ft-self-eval__desc">
            {task.description?.trim() || t('selfEval.fallbackDescription')}
          </p>
        </div>
        {task.requirements ? (
          <div className="ft-self-eval__text-block">
            <h3 className="ft-self-eval__label">{t('form.requirements')}</h3>
            <p className="ft-self-eval__desc">{task.requirements}</p>
          </div>
        ) : null}
        <p className="ft-self-eval__meta">
          <Calendar size={14} aria-hidden />
          {t('tasks.dueDate')}: {task.due_date ? formatFtDate(task.due_date) : t('selfEval.noDueDate')}
        </p>
      </article>

      <article className="ft-self-eval__card ft-self-eval__card--white">
        <StudentTaskInstructionSection
          task={task}
          onDownload={handleDownloadInstruction}
          disabled={downloadingInstruction || busy}
        />
        {downloadError ? (
          <p className="form-field__error" role="alert">
            {downloadError}
          </p>
        ) : null}
      </article>

      <article className="ft-self-eval__info-card ft-self-eval__info-card--standalone">
        <h3 className="ft-self-eval__section-title">{t('selfEval.instructionsTitle')}</h3>
        <p className="ft-self-eval__desc">{t('selfEval.instructionsText')}</p>
        <p className="ft-self-eval__desc">{t('selfEval.sourceRequirementHint')}</p>
        {task.ai_self_evaluation_prompt ? (
          <div className="ft-self-eval__prompt-inner">
            <strong>{t('selfEval.instructorPrompt')}</strong>
            <p>{task.ai_self_evaluation_prompt}</p>
          </div>
        ) : null}
      </article>

      <form className="ft-self-eval__form" onSubmit={handleSubmit} noValidate>
        <article className="ft-self-eval__card ft-self-eval__card--white">
          <FormTextarea
            label={t('selfEval.studentInputLabel')}
            placeholder={t('selfEval.studentInputPlaceholder')}
            value={studentDescription}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            rows={7}
            required
            disabled={busy}
            maxLength={MAX_INPUT_LENGTH}
          />
          <div className="ft-self-eval__char-row">
            {!inputValid && trimmedDescription.length > 0 ? (
              <p className="ft-self-eval__hint ft-self-eval__hint--warn">
                {t('selfEval.inputTooShort', { min: MIN_INPUT_LENGTH })}
              </p>
            ) : (
              <span className="ft-self-eval__hint">
                {t('selfEval.inputHint', { min: MIN_INPUT_LENGTH })}
              </span>
            )}
            <span className="ft-self-eval__char-count">
              {studentDescription.length}/{MAX_INPUT_LENGTH}
            </span>
          </div>

          <div className="ft-self-eval__upload">
            <span className="form-field__label">{t('selfEval.analysisFileLabel')}</span>
            <div className="ft-self-eval__info-card" role="note">
              <strong>{t('tasks.aiSupportedFilesTitle')}</strong>
              <p>{aiFileTypes?.notes || t('tasks.aiSupportedFilesNote')}</p>
              {aiFileTypes?.extensions?.length ? (
                <p className="ft-self-eval__hint">{aiFileTypes.extensions.join(' · ')}</p>
              ) : null}
            </div>
            {archiveWarning ? (
              <p className="ft-self-eval__hint ft-self-eval__hint--warn" role="status">
                {archiveWarning}
              </p>
            ) : null}
            {(files.length > 0 || uploadedFileIds.length > 0) && (
              <ul className="ft-student-task-item__file-list">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`}>
                    <FileText size={16} aria-hidden /> {f.name} ({formatBytes(f.size)})
                    <Button
                      type="button"
                      variant="outline"
                      className="btn--sm"
                      disabled={busy}
                      onClick={() => handleRemoveFile(i)}
                    >
                      <Trash2 size={14} aria-hidden />
                    </Button>
                  </li>
                ))}
                {uploadedFileIds.length && !files.length ? (
                  <li>
                    {t('selfEval.fileUploaded')} ({uploadedFileIds.length})
                    <Button
                      type="button"
                      variant="outline"
                      className="btn--sm"
                      disabled={busy}
                      onClick={() => handleRemoveFile()}
                    >
                      <Trash2 size={14} aria-hidden />
                      {t('selfEval.removeFile')}
                    </Button>
                  </li>
                ) : null}
              </ul>
            )}
            {uploadProgress != null ? (
              <p role="status">{t('tasks.uploadProgress', { percent: uploadProgress })}</p>
            ) : null}
            <FileDropzone
              disabled={busy}
              multiple
              hint={t('selfEval.analysisFileHint')}
              meta={t('tasks.dropzoneMeta')}
              accept={SUBMISSION_ACCEPT_ALL}
              onFile={handleFilePick}
            />
          </div>

          <div className="ft-self-eval__url-field">
            <label className="form-field__label" htmlFor="ft-project-url">
              <Link2 size={14} aria-hidden /> {t('selfEval.projectUrl')}
            </label>
            <input
              id="ft-project-url"
              className="form-field__control"
              type="url"
              inputMode="url"
              placeholder={t('selfEval.projectUrlPlaceholder')}
              value={projectUrl}
              disabled={busy}
              onChange={(e) => handleUrlChange(e.target.value)}
            />
            {urlError ? (
              <p className="form-field__error" role="alert">
                {urlError}
              </p>
            ) : (
              <p className="ft-self-eval__hint">{t('selfEval.projectUrlHint')}</p>
            )}
          </div>

          <div className="ft-self-eval__ai-actions">
            <Button
              type="button"
              variant="primary"
              disabled={!canAnalyze}
              onClick={() => {
                setError('');
                if (hasUrl && !isValidHttpUrl(urlTrimmed)) {
                  setUrlError(t('selfEval.urlInvalid'));
                  return;
                }
                aiMut.mutate();
              }}
            >
              <Sparkles size={16} aria-hidden />
              {aiMut.isPending || uploading ? t('selfEval.aiLoading') : t('selfEval.runAi')}
            </Button>
            {aiMut.isPending || uploading ? (
              <span className="ft-self-eval__loading-inline" role="status">
                {uploading ? t('selfEval.uploadingFile') : t('selfEval.aiLoading')}
              </span>
            ) : null}
          </div>
        </article>

        {aiReady || aiResponse ? (
          <article className="ft-self-eval__card ft-self-eval__ai-result">
            <div className="ft-self-eval__ai-result-head">
              <h3 className="ft-self-eval__section-title">{t('selfEval.aiResultLabel')}</h3>
              <Button
                type="button"
                variant="outline"
                className="btn--sm"
                disabled={!canAnalyze}
                onClick={() => {
                  setError('');
                  aiMut.mutate();
                }}
              >
                <Sparkles size={14} aria-hidden />
                {t('selfEval.rerunAi')}
              </Button>
            </div>
            {(aiMeta?.warnings || []).length ? (
              <div className="ft-self-eval__info-card" role="status">
                <strong>{t('selfEval.extractionWarnings')}</strong>
                <ul>
                  {aiMeta.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <FormTextarea
              label={t('selfEval.aiReviewLabel')}
              value={aiResponse}
              onChange={(e) => setAiResponse(e.target.value)}
              rows={10}
              placeholder={t('selfEval.aiResultPlaceholder')}
              disabled={busy || !aiMeta}
            />
            <p className="ft-self-eval__hint">{t('selfEval.aiReviewHint')}</p>
            {!aiMeta ? (
              <p className="ft-self-eval__hint ft-self-eval__hint--warn">{t('selfEval.aiStaleHint')}</p>
            ) : null}
          </article>
        ) : null}

        <article className="ft-self-eval__card ft-self-eval__card--white ft-self-eval__submit-card">
          <h3 className="ft-self-eval__section-title">{t('selfEval.submitSectionTitle')}</h3>
          <FormTextarea
            label={t('selfEval.finalNotesLabel')}
            value={finalNotes}
            onChange={(e) => setFinalNotes(e.target.value)}
            rows={3}
            disabled={busy}
          />
          {error ? (
            <p className="form-field__error ft-self-eval__error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="ft-self-eval__actions">
            <Button type="submit" variant="primary" disabled={!canSubmit}>
              <Upload size={16} aria-hidden />
              {submitMut.isPending ? t('selfEval.submitting') : t('selfEval.submit')}
            </Button>
          </div>
        </article>
      </form>
    </>
  );
}
