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
} from '../../../features/fieldTraining/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

function isPastDue(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${String(dateStr).slice(0, 10)}T12:00:00`);
  return due < today;
}

export function AdminFieldTrainingTasksPage() {
  const { id } = useParams();
  const { t } = useTranslation('fieldTraining');
  const { t: tCommon } = useTranslation('common');
  const formRef = useRef(null);
  const titleInputRef = useRef(null);

  const { data: oppData, isLoading: oppLoading } = useAdminFieldTraining(id);
  const { data: tasksData, isLoading, isError, error, refetch } = useOpportunityTasks(id);
  const { data: subsData } = useOpportunitySubmissions(id);
  const mut = useOpportunityTaskMutations(id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [formError, setFormError] = useState('');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [downloadError, setDownloadError] = useState('');

  const tasks = tasksData?.tasks ?? [];
  const submissions = subsData?.submissions ?? [];
  const opp = oppData?.opportunity;

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
    if (!title.trim()) return;
    try {
      await mut.create.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate || null,
      });
      setTitle('');
      setDescription('');
      setDueDate('');
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
    setFormError('');
  }

  async function saveEditTask(e) {
    e.preventDefault();
    if (!editingTaskId || !editTitle.trim()) return;
    try {
      await mut.update.mutateAsync({
        taskId: editingTaskId,
        body: {
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          due_date: editDueDate || null,
        },
      });
      setEditingTaskId(null);
      refetch();
    } catch (err) {
      setFormError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  async function handleDownloadSubmission(submissionId) {
    setDownloadError('');
    try {
      const file = await downloadFieldTrainingSubmission(submissionId, { asAdmin: true });
      saveFieldTrainingSubmissionBlob(file);
    } catch (err) {
      setDownloadError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
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
          <Link className="btn btn--outline btn--sm" to={`/admin/field-training/${id}/applications`}>
            <ArrowLeft size={16} aria-hidden /> {t('tasks.backToApplications')}
          </Link>
          <Link className="btn btn--ghost btn--sm" to="/admin/field-training">
            <ArrowLeft size={16} aria-hidden /> {t('backToList')}
          </Link>
        </div>
      </header>

      <AdminStatsGrid>
        <StatCard
          label={t('adminKpi.tasksCount')}
          value={oppLoading || isLoading ? '—' : tasks.length}
          hint={t('tasks.kpiTasksHint')}
          meta={t('adminKpi.liveData')}
          icon={ListChecks}
        />
        <StatCard
          label={t('adminKpi.submissionsCount')}
          value={oppLoading || isLoading ? '—' : submissions.length}
          hint={t('tasks.kpiSubmissionsHint')}
          meta={t('adminKpi.liveData')}
          icon={Upload}
        />
        <StatCard
          label={t('tasks.kpiTasksWithSubmissions')}
          value={oppLoading || isLoading ? '—' : tasksWithSubmissions}
          hint={t('tasks.kpiTasksWithSubmissionsHint')}
          meta={t('adminKpi.liveData')}
          icon={CheckCircle2}
        />
        <StatCard
          label={t('tasks.kpiTasksAwaiting')}
          value={oppLoading || isLoading ? '—' : tasksAwaitingSubmissions}
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

            <footer className="ft-tasks-form-card__actions">
              <Button type="submit" variant="primary" disabled={mut.create.isPending || !title.trim()}>
                <Plus size={16} aria-hidden />
                {mut.create.isPending ? t('tasks.addingTask') : t('tasks.addTask')}
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
                            <div className="ft-task-edit__actions">
                              <Button type="submit" variant="primary" className="btn--sm" disabled={mut.update.isPending}>
                                {t('save')}
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
                { key: 'file', label: t('tasks.file'), render: (r) => r.file_name ?? '—' },
                {
                  key: 'mime',
                  label: t('tasks.fileType'),
                  render: (r) => r.mime_type ?? '—',
                },
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
    </div>
  );
}
