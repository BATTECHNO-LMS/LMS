import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  ListChecks,
  Pencil,
  Plus,
  ShieldOff,
  Trash2,
  Upload,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminStatsGrid } from '../../../components/admin/AdminStatsGrid.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { EmptyState } from '../../../components/common/EmptyState.jsx';
import { StatCard } from '../../../components/common/StatCard.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { FormInput } from '../../../components/forms/FormInput.jsx';
import { FormTextarea } from '../../../components/forms/FormTextarea.jsx';
import { cn } from '../../../utils/helpers.js';
import {
  useAdminFieldTraining,
  useOpportunitySubmissions,
  useOpportunityTaskMutations,
  useOpportunityTasks,
  opportunityStatusVariant,
  formatFtDate,
  getOpportunityUniversityLabel,
  downloadFieldTrainingSubmission,
  saveFieldTrainingSubmissionBlob,
  downloadTaskInstructionFile,
  reviewFieldTrainingSubmission,
  fetchInstructorFieldTraining,
} from '../../../features/fieldTraining/index.js';
import { TaskInstructionFileField } from './components/TaskInstructionFileField.jsx';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fieldTrainingKeys } from '../../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

function isPastDue(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${String(dateStr).slice(0, 10)}T12:00:00`);
  return due < today;
}

export function AdminFieldTrainingTasksPage({ apiScope = 'admin' } = {}) {
  const { id } = useParams();
  const isInstructor = apiScope === 'instructor';
  const { t } = useTranslation('fieldTraining');
  const { t: tCommon } = useTranslation('common');
  const formRef = useRef(null);
  const titleInputRef = useRef(null);

  const { data: oppData, isLoading: oppLoading } = useAdminFieldTraining(id, {
    enabled: !isInstructor,
  });
  const { data: instructorOppData, isLoading: instructorOppLoading, isError: instructorOppError, error: instructorOppErr } = useQuery({
    queryKey: fieldTrainingKeys.instructorDetail(id),
    queryFn: () => fetchInstructorFieldTraining(id),
    enabled: isInstructor && Boolean(id),
    retry: (count, err) => err?.response?.status !== 403 && count < 2,
  });
  const { data: tasksData, isLoading, isError, error, refetch } = useOpportunityTasks(id, { scope: apiScope });
  const { data: subsData } = useOpportunitySubmissions(id, { scope: apiScope });
  const mut = useOpportunityTaskMutations(id, apiScope);
  const qc = useQueryClient();

  const reviewMut = useMutation({
    mutationFn: ({ submissionId, body }) =>
      reviewFieldTrainingSubmission(submissionId, body, { asInstructor: isInstructor }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.submissions(id, apiScope) });
      setReviewModal(null);
      setReviewFeedback('');
    },
  });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isFinalTask, setIsFinalTask] = useState(false);
  const [requiresAi, setRequiresAi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [instructionFileId, setInstructionFileId] = useState(null);
  const [removeInstructionFile, setRemoveInstructionFile] = useState(false);
  const [instructionUploading, setInstructionUploading] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editIsFinalTask, setEditIsFinalTask] = useState(false);
  const [editRequiresAi, setEditRequiresAi] = useState(false);
  const [editAiPrompt, setEditAiPrompt] = useState('');
  const [editInstructionFileId, setEditInstructionFileId] = useState(null);
  const [editRemoveInstructionFile, setEditRemoveInstructionFile] = useState(false);
  const [editInstructionUploading, setEditInstructionUploading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [reviewStatus, setReviewStatus] = useState('approved');

  const tasks = tasksData?.tasks ?? [];
  const submissions = subsData?.submissions ?? [];
  const opp = isInstructor ? instructorOppData?.opportunity : oppData?.opportunity;
  const oppBusy = isInstructor ? instructorOppLoading : oppLoading;
  const listBase = isInstructor ? '/instructor/field-training' : '/admin/field-training';

  const submissionCountByTask = useMemo(() => {
    const map = {};
    submissions.forEach((s) => {
      const tid = s.task_id;
      if (tid) map[tid] = (map[tid] || 0) + 1;
    });
    return map;
  }, [submissions]);

  const tasksWithSubmissions = useMemo(
    () => tasks.filter((task) => (submissionCountByTask[task.id] ?? 0) > 0).length,
    [tasks, submissionCountByTask]
  );

  const tasksAwaitingSubmissions = useMemo(
    () => tasks.filter((task) => (submissionCountByTask[task.id] ?? 0) === 0).length,
    [tasks, submissionCountByTask]
  );

  function focusAddTaskForm() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    titleInputRef.current?.focus();
  }

  async function handleAdd(e) {
    e.preventDefault();
    setFormError('');
    if (!title.trim() || mut.create.isPending || instructionUploading) return;
    try {
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate || null,
        is_final_task: isFinalTask,
        requires_ai_self_evaluation: requiresAi,
        ai_self_evaluation_prompt: requiresAi ? aiPrompt.trim() || null : null,
      };
      if (instructionFileId) body.instruction_file_id = instructionFileId;
      await mut.create.mutateAsync(body);
      setTitle('');
      setDescription('');
      setDueDate('');
      setIsFinalTask(false);
      setRequiresAi(false);
      setAiPrompt('');
      setInstructionFileId(null);
      setRemoveInstructionFile(false);
      refetch();
    } catch (err) {
      setFormError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  function startEditTask(task) {
    setEditingTaskId(task.id);
    setEditTitle(task.title || '');
    setEditDescription(task.description || '');
    setEditDueDate(task.due_date ? String(task.due_date).slice(0, 10) : '');
    setEditIsFinalTask(Boolean(task.is_final_task));
    setEditRequiresAi(Boolean(task.requires_ai_self_evaluation));
    setEditAiPrompt(task.ai_self_evaluation_prompt || '');
    setEditInstructionFileId(null);
    setEditRemoveInstructionFile(false);
    setFormError('');
  }

  async function handleDownloadInstruction(taskId) {
    setDownloadError('');
    try {
      const file = await downloadTaskInstructionFile(taskId, {
        asAdmin: !isInstructor,
        asInstructor: isInstructor,
      });
      if (file) saveFieldTrainingSubmissionBlob(file);
    } catch (err) {
      setDownloadError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  async function saveEditTask(e) {
    e.preventDefault();
    if (!editingTaskId || !editTitle.trim() || mut.update.isPending || editInstructionUploading) return;
    try {
      const body = {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        due_date: editDueDate || null,
        is_final_task: editIsFinalTask,
        requires_ai_self_evaluation: editRequiresAi,
        ai_self_evaluation_prompt: editRequiresAi ? editAiPrompt.trim() || null : null,
      };
      if (editInstructionFileId) body.instruction_file_id = editInstructionFileId;
      if (editRemoveInstructionFile) body.remove_instruction_file = true;
      await mut.update.mutateAsync({
        taskId: editingTaskId,
        body,
      });
      setEditingTaskId(null);
      setEditInstructionUploading(false);
      refetch();
    } catch (err) {
      setFormError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  async function handleDownloadSubmission(submissionId) {
    setDownloadError('');
    try {
      const file = await downloadFieldTrainingSubmission(submissionId, {
        asAdmin: !isInstructor,
        asInstructor: isInstructor,
      });
      if (file) saveFieldTrainingSubmissionBlob(file);
    } catch (err) {
      setDownloadError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  if (isInstructor && instructorOppError && instructorOppErr?.response?.status === 403) {
    return (
      <div className="page page--dashboard page--admin ft-page">
        <EmptyState
          icon={ShieldOff}
          title={t('instructor.forbiddenTitle')}
          description={t('instructor.forbiddenDescription')}
          action={
            <Link className="btn btn--outline" to={listBase}>
              <ArrowLeft size={16} aria-hidden /> {t('backToList')}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin ft-page ft-tasks-page">
      <header className="ft-tasks-page__header">
        <div className="ft-tasks-page__header-top">
          <div className="ft-tasks-page__header-text">
            <p className="ft-tasks-page__eyebrow">{t('tasks.adminTitle')}</p>
            <h1 className="ft-tasks-page__title">{opp?.title ?? '—'}</h1>
            {opp?.university || opp?.organization_name ? (
              <p className="ft-tasks-page__meta">
                {getOpportunityUniversityLabel(opp, t('form.universityUnspecified'))}
              </p>
            ) : null}
          </div>
          {opp?.status ? (
            <StatusBadge variant={opportunityStatusVariant(opp.status)} className="ft-tasks-page__status">
              {t(`status.${opp.status}`)}
            </StatusBadge>
          ) : null}
        </div>

        <div className="ft-tasks-page__nav">
          {!isInstructor ? (
            <Link className="btn btn--outline btn--sm" to={`${listBase}/${id}/applications`}>
              <ArrowLeft size={16} aria-hidden /> {t('tasks.backToApplications')}
            </Link>
          ) : (
            <Link className="btn btn--outline btn--sm" to={`${listBase}/${id}/manage`}>
              <ArrowLeft size={16} aria-hidden /> {t('manageHub.backToManage')}
            </Link>
          )}
          <Link className="btn btn--ghost btn--sm" to={listBase}>
            <ArrowLeft size={16} aria-hidden /> {t('backToList')}
          </Link>
        </div>
      </header>

      <AdminStatsGrid>
        <StatCard
          label={t('adminKpi.tasksCount')}
          value={oppBusy || isLoading ? '—' : tasks.length}
          hint={t('tasks.kpiTasksHint')}
          meta={t('adminKpi.liveData')}
          icon={ListChecks}
        />
        <StatCard
          label={t('adminKpi.submissionsCount')}
          value={oppBusy || isLoading ? '—' : submissions.length}
          hint={t('tasks.kpiSubmissionsHint')}
          meta={t('adminKpi.liveData')}
          icon={Upload}
        />
        <StatCard
          label={t('tasks.kpiTasksWithSubmissions')}
          value={oppBusy || isLoading ? '—' : tasksWithSubmissions}
          hint={t('tasks.kpiTasksWithSubmissionsHint')}
          meta={t('adminKpi.liveData')}
          icon={CheckCircle2}
        />
        <StatCard
          label={t('tasks.kpiTasksAwaiting')}
          value={oppBusy || isLoading ? '—' : tasksAwaitingSubmissions}
          hint={t('tasks.kpiTasksAwaitingHint')}
          meta={t('adminKpi.liveData')}
          icon={Clock}
        />
      </AdminStatsGrid>

      <div className="ft-tasks-layout">
        <section className="ft-tasks-form-card" ref={formRef} aria-labelledby="ft-add-task-title">
          <header className="ft-tasks-form-card__head">
            <span className="ft-tasks-form-card__icon" aria-hidden>
              <Plus size={20} />
            </span>
            <div>
              <h2 id="ft-add-task-title" className="ft-tasks-form-card__title">
                {t('tasks.addTaskSectionTitle')}
              </h2>
              <p className="ft-tasks-form-card__subtitle">{t('tasks.addTaskSectionSubtitle')}</p>
            </div>
          </header>

          <form className="ft-tasks-form-card__form" onSubmit={handleAdd} noValidate>
            {formError ? (
              <p className="ft-tasks-form-card__error" role="alert">
                {formError}
              </p>
            ) : null}

            <div className="ft-tasks-form-card__row">
              <FormInput
                id="task-title"
                label={t('tasks.taskTitle')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                ref={titleInputRef}
              />
              <FormInput
                id="task-due"
                label={t('tasks.dueDate')}
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <FormTextarea
              id="task-desc"
              label={t('tasks.taskDescription')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />

            <label className="form-field form-field--checkbox">
              <input type="checkbox" checked={isFinalTask} onChange={(e) => setIsFinalTask(e.target.checked)} />
              <span>{t('tasks.finalTask')}</span>
            </label>
            <label className="form-field form-field--checkbox">
              <input type="checkbox" checked={requiresAi} onChange={(e) => setRequiresAi(e.target.checked)} />
              <span>{t('tasks.requiresAi')}</span>
            </label>
            {requiresAi ? (
              <>
                <FormTextarea
                  label={t('tasks.aiPrompt')}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={4}
                />
                <p className="form-field__hint">{t('tasks.aiPromptHelp')}</p>
              </>
            ) : null}

            <TaskInstructionFileField
              opportunityId={id}
              onUploaded={(fileId) => {
                setInstructionFileId(fileId);
                setRemoveInstructionFile(false);
              }}
              onRemove={() => {
                setInstructionFileId(null);
                setRemoveInstructionFile(false);
              }}
              onUploadingChange={setInstructionUploading}
              disabled={mut.create.isPending}
            />

            <footer className="ft-tasks-form-card__actions">
              <Button
                type="submit"
                variant="primary"
                disabled={mut.create.isPending || instructionUploading || !title.trim()}
              >
                <Plus size={16} aria-hidden />
                {mut.create.isPending
                  ? t('tasks.addingTask')
                  : instructionUploading
                    ? t('tasks.uploadingInstruction')
                    : t('tasks.addTask')}
              </Button>
            </footer>
          </form>
        </section>

        <section className="ft-tasks-list-section" aria-labelledby="ft-tasks-list-title">
          <header className="ft-tasks-list-section__head">
            <div>
              <h2 id="ft-tasks-list-title" className="ft-tasks-list-section__title">
                {t('tasks.listTitle')}{' '}
                <span className="ft-tasks-list-section__count">({tasks.length})</span>
              </h2>
              <p className="ft-tasks-list-section__help">{t('tasks.listHelp')}</p>
            </div>
          </header>

          {isLoading ? (
            <div className="ft-tasks-skeleton" aria-busy="true" aria-label={tCommon('loading')}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="ft-tasks-skeleton__card" />
              ))}
            </div>
          ) : isError ? (
            <EmptyState
              icon={ListChecks}
              title={t('tasks.loadErrorTitle')}
              description={String(error?.message ?? tCommon('errors.generic'))}
              action={
                <Button type="button" variant="primary" onClick={() => refetch()}>
                  {t('retryLoad')}
                </Button>
              }
            />
          ) : tasks.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={t('tasks.emptyTitleNew')}
              description={t('tasks.emptyDescNew')}
              action={
                <Button type="button" variant="primary" onClick={focusAddTaskForm}>
                  <Plus size={16} aria-hidden /> {t('tasks.addTask')}
                </Button>
              }
            />
          ) : (
            <ol className="ft-tasks-timeline">
              {tasks.map((task, index) => {
                const submissionCount = submissionCountByTask[task.id] ?? 0;
                const overdue = isPastDue(task.due_date);
                return (
                  <li key={task.id}>
                    <article className={cn('ft-task-item', overdue && 'ft-task-item--overdue')}>
                      <span className="ft-task-item__index" aria-hidden>
                        {index + 1}
                      </span>
                      <div className="ft-task-item__body">
                        <header className="ft-task-item__head">
                          <h3 className="ft-task-item__title">{task.title}</h3>
                          <div className="ft-task-item__actions">
                            <button
                              type="button"
                              className="btn btn--icon btn--sm"
                              onClick={() => startEditTask(task)}
                              aria-label={t('tasks.edit')}
                            >
                              <Pencil size={16} aria-hidden />
                            </button>
                            <button
                              type="button"
                              className="btn btn--icon btn--sm ft-task-item__delete"
                              onClick={() => mut.remove.mutate(task.id)}
                              disabled={mut.remove.isPending}
                              aria-label={t('tasks.delete')}
                            >
                              <Trash2 size={16} aria-hidden />
                            </button>
                          </div>
                        </header>

                        {editingTaskId === task.id ? (
                          <form className="ft-task-edit" onSubmit={saveEditTask}>
                            <FormInput
                              label={t('tasks.taskTitle')}
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                            />
                            <FormTextarea
                              label={t('tasks.description')}
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              rows={3}
                            />
                            <FormInput
                              label={t('tasks.dueDate')}
                              type="date"
                              value={editDueDate}
                              onChange={(e) => setEditDueDate(e.target.value)}
                            />
                            <label className="form-field form-field--checkbox">
                              <input
                                type="checkbox"
                                checked={editIsFinalTask}
                                onChange={(e) => setEditIsFinalTask(e.target.checked)}
                              />
                              <span>{t('tasks.finalTask')}</span>
                            </label>
                            <label className="form-field form-field--checkbox">
                              <input
                                type="checkbox"
                                checked={editRequiresAi}
                                onChange={(e) => setEditRequiresAi(e.target.checked)}
                              />
                              <span>{t('tasks.requiresAi')}</span>
                            </label>
                            {editRequiresAi ? (
                              <FormTextarea
                                label={t('tasks.aiPrompt')}
                                value={editAiPrompt}
                                onChange={(e) => setEditAiPrompt(e.target.value)}
                                rows={3}
                              />
                            ) : null}
                            <TaskInstructionFileField
                              opportunityId={id}
                              taskId={task.id}
                              existing={
                                !editRemoveInstructionFile && task.has_instruction_file
                                  ? { name: task.instruction_file_name, size: task.instruction_file_size }
                                  : null
                              }
                              onUploaded={(fileId) => {
                                setEditInstructionFileId(fileId);
                                setEditRemoveInstructionFile(false);
                              }}
                              onRemove={() => {
                                setEditInstructionFileId(null);
                                setEditRemoveInstructionFile(true);
                              }}
                              onDownloadExisting={
                                task.has_instruction_file && !editRemoveInstructionFile
                                  ? () => handleDownloadInstruction(task.id)
                                  : undefined
                              }
                              onUploadingChange={setEditInstructionUploading}
                              disabled={mut.update.isPending}
                            />
                            <div className="ft-task-edit__actions">
                              <Button
                                type="submit"
                                variant="primary"
                                className="btn--sm"
                                disabled={mut.update.isPending || editInstructionUploading}
                              >
                                {mut.update.isPending
                                  ? t('saving')
                                  : editInstructionUploading
                                    ? t('tasks.uploadingInstruction')
                                    : t('save')}
                              </Button>
                              <Button type="button" variant="outline" className="btn--sm" onClick={() => setEditingTaskId(null)}>
                                {tCommon('actions.cancel')}
                              </Button>
                            </div>
                          </form>
                        ) : null}

                        {task.description ? (
                          <p className="ft-task-item__desc">{task.description}</p>
                        ) : null}

                        <div className="ft-task-item__meta">
                          {task.due_date ? (
                            <span
                              className={cn(
                                'ft-task-item__badge',
                                overdue && 'ft-task-item__badge--overdue'
                              )}
                            >
                              <Calendar size={14} aria-hidden />
                              {t('tasks.dueDate')}: {formatFtDate(task.due_date)}
                              {overdue ? ` · ${t('tasks.overdue')}` : ''}
                            </span>
                          ) : null}
                          <span className="ft-task-item__badge ft-task-item__badge--submissions">
                            <Upload size={14} aria-hidden />
                            {t('tasks.submissionCount', { count: submissionCount })}
                          </span>
                          {task.is_final_task ? (
                            <span className="ft-task-item__badge ft-task-item__badge--final">
                              {t('tasks.finalTaskBadge')}
                            </span>
                          ) : null}
                          {task.requires_ai_self_evaluation ? (
                            <span className="ft-task-item__badge ft-task-item__badge--ai">
                              {t('tasks.aiBadge')}
                            </span>
                          ) : null}
                          {task.has_instruction_file ? (
                            <span className="ft-task-item__badge ft-task-item__badge--instruction">
                              {t('tasks.instructionFileBadge')}
                            </span>
                          ) : null}
                          <span
                            className={cn(
                              'ft-task-item__badge',
                              submissionCount > 0
                                ? 'ft-task-item__badge--done'
                                : 'ft-task-item__badge--pending'
                            )}
                          >
                            {submissionCount > 0 ? t('tasks.submitted') : t('tasks.pending')}
                          </span>
                        </div>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      <section className="ft-tasks-submissions" aria-labelledby="ft-submissions-title">
        <header className="ft-tasks-submissions__head">
          <span className="ft-tasks-submissions__icon" aria-hidden>
            <FileText size={20} />
          </span>
          <div>
            <h2 id="ft-submissions-title" className="ft-tasks-submissions__title">
              {t('tasks.submissionsTitle')}{' '}
              <span className="ft-tasks-list-section__count">({submissions.length})</span>
            </h2>
            <p className="ft-tasks-submissions__help">{t('tasks.submissionsHelp')}</p>
          </div>
        </header>

        {!submissions.length ? (
          <EmptyState icon={FileText} title={t('tasks.noSubmissionsTitle')} description={t('tasks.noSubmissions')} />
        ) : (
          <div className="ft-tasks-submissions__table">
            {downloadError ? (
              <p className="form-field__error" role="alert">
                {downloadError}
              </p>
            ) : null}
            <DataTable
              columns={[
                { key: 'student', label: t('table.student'), render: (r) => r.student_name ?? '—' },
                { key: 'task', label: t('tasks.taskTitle'), render: (r) => r.task_title ?? '—' },
                {
                  key: 'timing',
                  label: t('tasks.timing'),
                  render: (r) => (r.is_late ? t('tasks.late') : t('tasks.onTime')),
                },
                {
                  key: 'review',
                  label: t('tasks.reviewStatus'),
                  render: (r) => t(`tasks.reviewStatuses.${r.review_status || 'pending'}`),
                },
                { key: 'file', label: t('tasks.file'), render: (r) => r.file_name ?? '—' },
                {
                  key: 'link',
                  label: t('tasks.viewFile'),
                  render: (r) => (
                    <Button
                      type="button"
                      variant="outline"
                      className="btn--sm"
                      onClick={() => handleDownloadSubmission(r.id)}
                    >
                      {t('tasks.download')}
                    </Button>
                  ),
                },
                {
                  key: 'reviewAction',
                  label: t('tasks.review'),
                  render: (r) => (
                    <Button
                      type="button"
                      variant="outline"
                      className="btn--sm"
                      onClick={() => {
                        setReviewModal(r);
                        setReviewFeedback(r.instructor_feedback || '');
                        setReviewStatus(r.review_status === 'rejected' ? 'rejected' : 'approved');
                      }}
                    >
                      {t('tasks.review')}
                    </Button>
                  ),
                },
                {
                  key: 'at',
                  label: t('tasks.submittedAt'),
                  render: (r) =>
                    r.submitted_at ? String(r.submitted_at).slice(0, 16).replace('T', ' ') : '—',
                },
              ]}
              rows={submissions}
            />
          </div>
        )}
      </section>

      {reviewModal ? (
        <div className="ft-modal-backdrop" onClick={() => setReviewModal(null)} role="presentation">
          <div className="ft-modal ft-modal--wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <header className="ft-modal__header">
              <h2 className="ft-modal__title">{t('tasks.reviewModalTitle')}</h2>
              <p className="ft-modal__subtitle">
                {reviewModal.student_name} — {reviewModal.task_title}
              </p>
            </header>
            <div className="ft-modal__body">
              {reviewModal.student_self_evaluation_input ? (
                <div className="ft-review-block">
                  <strong>{t('tasks.aiStudentInput')}</strong>
                  <p>{reviewModal.student_self_evaluation_input}</p>
                </div>
              ) : null}
              {reviewModal.project_url ? (
                <div className="ft-review-block">
                  <strong>{t('selfEval.projectUrl')}</strong>
                  <p>
                    <a href={reviewModal.project_url} target="_blank" rel="noreferrer">
                      {reviewModal.project_url}
                    </a>
                  </p>
                </div>
              ) : null}
              {(reviewModal.file_extraction_status || reviewModal.url_extraction_status) ? (
                <div className="ft-review-block">
                  <strong>{t('selfEval.extractionStatus')}</strong>
                  <p>
                    {t('selfEval.fileExtraction')}: {reviewModal.file_extraction_status || '—'}
                    {' · '}
                    {t('selfEval.urlExtraction')}: {reviewModal.url_extraction_status || '—'}
                  </p>
                  {reviewModal.extraction_errors ? <p>{reviewModal.extraction_errors}</p> : null}
                </div>
              ) : null}
              {reviewModal.ai_prompt_used ? (
                <div className="ft-review-block">
                  <strong>{t('tasks.aiPromptUsed')}</strong>
                  <p>{reviewModal.ai_prompt_used}</p>
                </div>
              ) : null}
              {reviewModal.ai_model_provider || reviewModal.ai_model_name ? (
                <div className="ft-review-block">
                  <strong>{t('tasks.aiModel')}</strong>
                  <p>
                    {[reviewModal.ai_model_provider, reviewModal.ai_model_name].filter(Boolean).join(' · ')}
                  </p>
                </div>
              ) : null}
              {reviewModal.ai_raw_response ? (
                <div className="ft-review-block">
                  <strong>{t('tasks.aiRawResponse')}</strong>
                  <p>{reviewModal.ai_raw_response}</p>
                </div>
              ) : null}
              {reviewModal.ai_response_inserted_text ? (
                <div className="ft-review-block">
                  <strong>{t('tasks.aiResponseInserted')}</strong>
                  <p>{reviewModal.ai_response_inserted_text}</p>
                </div>
              ) : null}
              {reviewModal.final_student_notes ? (
                <div className="ft-review-block">
                  <strong>{t('tasks.finalNotes')}</strong>
                  <p>{reviewModal.final_student_notes}</p>
                </div>
              ) : null}
              <label className="form-field__label">{t('tasks.reviewStatus')}</label>
              <select
                className="ft-modal-select__control"
                value={reviewStatus}
                onChange={(e) => setReviewStatus(e.target.value)}
              >
                <option value="approved">{t('tasks.reviewStatuses.approved')}</option>
                <option value="rejected">{t('tasks.reviewStatuses.rejected')}</option>
                <option value="needs_revision">{t('tasks.reviewStatuses.needs_revision')}</option>
              </select>
              <FormTextarea
                label={t('tasks.instructorFeedback')}
                value={reviewFeedback}
                onChange={(e) => setReviewFeedback(e.target.value)}
                rows={4}
              />
            </div>
            <footer className="ft-modal__footer">
              <Button type="button" variant="outline" onClick={() => setReviewModal(null)}>
                {t('cancel')}
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={reviewMut.isPending}
                onClick={() =>
                  reviewMut.mutate({
                    submissionId: reviewModal.id,
                    body: {
                      review_status: reviewStatus,
                      instructor_feedback: reviewFeedback.trim() || null,
                    },
                  })
                }
              >
                {reviewMut.isPending ? t('saving') : t('tasks.saveReview')}
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
