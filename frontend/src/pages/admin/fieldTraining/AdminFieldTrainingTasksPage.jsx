import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { FormInput } from '../../../components/forms/FormInput.jsx';
import { FormTextarea } from '../../../components/forms/FormTextarea.jsx';
import {
  useAdminFieldTraining,
  useOpportunitySubmissions,
  useOpportunityTaskMutations,
  useOpportunityTasks,
} from '../../../features/fieldTraining/index.js';
import { resolveUploadUrl } from '../../../utils/uploadUrl.js';
import { formatFtDate } from '../../../features/fieldTraining/fieldTrainingUi.js';

export function AdminFieldTrainingTasksPage() {
  const { id } = useParams();
  const { t } = useTranslation('fieldTraining');
  const { data: oppData } = useAdminFieldTraining(id);
  const { data: tasksData, isLoading, refetch } = useOpportunityTasks(id);
  const { data: subsData } = useOpportunitySubmissions(id);
  const mut = useOpportunityTaskMutations(id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  const tasks = tasksData?.tasks ?? [];
  const submissions = subsData?.submissions ?? [];
  const oppTitle = oppData?.opportunity?.title ?? '';

  const submissionCountByTask = useMemo(() => {
    const map = {};
    submissions.forEach((s) => {
      const tid = s.task_id;
      if (tid) map[tid] = (map[tid] || 0) + 1;
    });
    return map;
  }, [submissions]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!title.trim()) return;
    await mut.create.mutateAsync({
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate || null,
    });
    setTitle('');
    setDescription('');
    setDueDate('');
    refetch();
  }

  return (
    <div className="page page--dashboard page--admin ft-page">
      <div className="ft-breadcrumb-actions">
        <Link className="btn btn--ghost btn--sm" to={`/admin/field-training/${id}/applications`}>
          <ArrowLeft size={16} /> {t('tasks.backToApplications')}
        </Link>
        <Link className="btn btn--ghost btn--sm" to="/admin/field-training">
          <ArrowLeft size={16} /> {t('backToList')}
        </Link>
      </div>

      <header className="ft-detail-hero">
        <h1 className="ft-detail-hero__title">{oppTitle}</h1>
        <p className="ft-detail-hero__org">{t('tasks.adminTitle')}</p>
        <div className="ft-kpi-grid" style={{ marginTop: '1rem' }}>
          <div className="ft-kpi-card">
            <span className="ft-kpi-card__value">{tasks.length}</span>
            <span className="ft-kpi-card__label">{t('adminKpi.tasksCount')}</span>
          </div>
          <div className="ft-kpi-card ft-kpi-card--gold">
            <span className="ft-kpi-card__value">{submissions.length}</span>
            <span className="ft-kpi-card__label">{t('adminKpi.submissionsCount')}</span>
          </div>
        </div>
      </header>

      <section className="ft-filters-card">
        <h2 className="ft-section-title" style={{ marginTop: 0 }}>
          {t('tasks.addTask')}
        </h2>
        <form className="ft-form-section__grid ft-form-section__grid--full" onSubmit={handleAdd} noValidate>
          <FormInput
            id="task-title"
            label={t('tasks.taskTitle')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <FormTextarea
            id="task-desc"
            label={t('tasks.taskDescription')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
          <FormInput
            id="task-due"
            label={t('tasks.dueDate')}
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <div>
            <Button type="submit" variant="primary" disabled={mut.create.isPending}>
              <Plus size={16} aria-hidden /> {t('tasks.addTask')}
            </Button>
          </div>
        </form>
      </section>

      <h2 className="ft-section-title">
        {t('tasks.listTitle')} ({tasks.length})
      </h2>

      {isLoading ? (
        <LoadingSpinner />
      ) : tasks.length === 0 ? (
        <div className="ft-empty">
          <h3>{t('tasks.emptyTitle')}</h3>
          <p>{t('tasks.empty')}</p>
        </div>
      ) : (
        tasks.map((task, index) => (
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
                <p className="crud-muted">
                  {t('tasks.submissionCount', { count: submissionCountByTask[task.id] ?? 0 })}
                </p>
              </div>
              <button
                type="button"
                className="btn btn--icon btn--ghost"
                onClick={() => mut.remove.mutate(task.id)}
                aria-label={t('tasks.delete')}
              >
                <Trash2 size={18} />
              </button>
            </header>
          </article>
        ))
      )}

      <h2 className="ft-section-title" style={{ marginTop: '1.5rem' }}>
        {t('tasks.submissionsTitle')} ({submissions.length})
      </h2>

      {!submissions.length ? (
        <div className="ft-empty">
          <FileText size={40} aria-hidden />
          <h3>{t('tasks.noSubmissionsTitle')}</h3>
          <p>{t('tasks.noSubmissions')}</p>
        </div>
      ) : (
        <div className="ft-admin-table-wrap section-card" style={{ padding: '1rem' }}>
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
                render: (r) => {
                  const url = resolveUploadUrl(r.file_path || r.file_url);
                  return url ? (
                    <a href={url} target="_blank" rel="noreferrer" className="btn btn--sm btn--outline">
                      {t('tasks.open')}
                    </a>
                  ) : (
                    '—'
                  );
                },
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
    </div>
  );
}
