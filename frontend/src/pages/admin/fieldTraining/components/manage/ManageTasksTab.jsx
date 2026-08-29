import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, ExternalLink, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../../components/common/Button.jsx';
import { FormInput } from '../../../../../components/forms/FormInput.jsx';
import { FormTextarea } from '../../../../../components/forms/FormTextarea.jsx';
import { StatusBadge } from '../../../../../components/admin/StatusBadge.jsx';
import {
  downloadTaskInstructionFile,
  formatFtDate,
  saveFieldTrainingSubmissionBlob,
  useOpportunitySubmissions,
  useOpportunityTaskMutations,
  useOpportunityTasks,
} from '../../../../../features/fieldTraining/index.js';
import { TaskInstructionFileField } from '../TaskInstructionFileField.jsx';
import { getApiErrorMessage } from '../../../../../services/apiHelpers.js';
import { ManageTabEmpty, ManageTabError, ManageTabSkeleton } from './ManageTabStates.jsx';
import {
  GRADING_MODES,
  resolveTaskGradingMode,
  gradingModeLabelKey,
} from '../../../../../features/fieldTraining/fieldTrainingGrading.js';

const emptyForm = {
  title: '',
  description: '',
  dueDate: '',
  isFinalTask: false,
  isRequired: true,
  gradingMode: 'AI',
  aiPrompt: '',
  instructionFileId: null,
};

export function ManageTasksTab({ opportunityId, apiScope = 'admin', onOpenSubmissions }) {
  const isInstructor = apiScope === 'instructor';
  const listBase = isInstructor ? '/instructor/field-training' : '/admin/field-training';
  const { t } = useTranslation('fieldTraining');
  const { t: tCommon } = useTranslation('common');
  const { data, isLoading, isError, error, refetch } = useOpportunityTasks(opportunityId, {
    enabled: Boolean(opportunityId),
    scope: apiScope,
  });
  const { data: subsData } = useOpportunitySubmissions(opportunityId, {
    enabled: Boolean(opportunityId),
    scope: apiScope,
  });
  const mut = useOpportunityTaskMutations(opportunityId, apiScope);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [instructionUploading, setInstructionUploading] = useState(false);
  const [removeInstructionFile, setRemoveInstructionFile] = useState(false);
  const [formError, setFormError] = useState('');
  const [downloadError, setDownloadError] = useState('');

  const tasks = data?.tasks ?? [];
  const submissions = subsData?.submissions ?? [];
  const submissionCountByTask = useMemo(() => {
    const map = {};
    submissions.forEach((s) => {
      if (s.task_id) map[s.task_id] = (map[s.task_id] || 0) + 1;
    });
    return map;
  }, [submissions]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setRemoveInstructionFile(false);
    setShowForm(false);
    setFormError('');
  }

  function startEdit(task) {
    setEditingId(task.id);
    setShowForm(true);
    setRemoveInstructionFile(false);
    setForm({
      title: task.title || '',
      description: task.description || '',
      dueDate: task.due_date ? String(task.due_date).slice(0, 10) : '',
      isFinalTask: Boolean(task.is_final_task),
      isRequired: task.is_required !== false,
      gradingMode: resolveTaskGradingMode(task),
      aiPrompt: task.ai_self_evaluation_prompt || '',
      instructionFileId: null,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!form.title.trim() || mut.create.isPending || mut.update.isPending || instructionUploading) return;
    try {
      const body = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        due_date: form.dueDate || null,
        is_final_task: form.isFinalTask,
        is_required: form.isRequired,
        grading_mode: form.gradingMode,
        requires_ai_self_evaluation: form.gradingMode === GRADING_MODES.AI,
        ai_self_evaluation_prompt:
          form.gradingMode === GRADING_MODES.AI ? form.aiPrompt.trim() || null : null,
      };
      if (form.instructionFileId) body.instruction_file_id = form.instructionFileId;
      if (editingId && removeInstructionFile) body.remove_instruction_file = true;

      if (editingId) {
        await mut.update.mutateAsync({ taskId: editingId, body });
      } else {
        await mut.create.mutateAsync(body);
      }
      resetForm();
      refetch();
    } catch (err) {
      setFormError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
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

  async function handleDelete(taskId) {
    if (!window.confirm(t('tasks.confirmDelete', { defaultValue: 'حذف هذه المهمة؟' }))) return;
    setFormError('');
    try {
      await mut.remove.mutateAsync(taskId);
      if (editingId === taskId) resetForm();
      refetch();
    } catch (err) {
      setFormError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  if (isLoading) return <ManageTabSkeleton rows={3} />;
  if (isError) {
    return <ManageTabError message={getApiErrorMessage(error)} onRetry={() => refetch()} />;
  }

  const busy = mut.create.isPending || mut.update.isPending || mut.remove.isPending || instructionUploading;

  return (
    <div className="ft-manage-panel">
      <header className="ft-manage-panel__head">
        <div>
          <h2 className="ft-manage-panel__title">{t('tasks.adminTitle')}</h2>
          <p className="ft-manage-panel__desc">{t('manageHub.tasksDesc')}</p>
        </div>
        <div className="ft-manage-panel__head-actions">
          <Button
            type="button"
            variant="primary"
            className="btn--sm"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            <Plus size={14} aria-hidden />
            {t('tasks.addTask')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="btn--sm"
            onClick={() => onOpenSubmissions?.()}
          >
            {t('manageHub.tabs.submissions')}
          </Button>
          <Button as={Link} to={`${listBase}/${opportunityId}/tasks`} variant="outline" className="btn--sm">
            <ExternalLink size={14} aria-hidden />
            {t('manageHub.openFullPage')}
          </Button>
        </div>
      </header>

      {showForm ? (
        <form className="ft-manage-form" onSubmit={handleSubmit}>
          <FormInput
            label={t('tasks.taskTitle')}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
          <FormTextarea
            label={t('tasks.description')}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
          />
          <FormInput
            type="date"
            label={t('tasks.dueDate')}
            value={form.dueDate}
            onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
          />
          <label className="ft-manage-check">
            <input
              type="checkbox"
              checked={form.isFinalTask}
              onChange={(e) => setForm((f) => ({ ...f, isFinalTask: e.target.checked }))}
            />
            {t('tasks.finalTask')}
          </label>
          <label className="ft-manage-check">
            <input
              type="checkbox"
              checked={form.isRequired}
              onChange={(e) => setForm((f) => ({ ...f, isRequired: e.target.checked }))}
            />
            {t('tasks.requiredTask')}
          </label>
          <div className="form-field">
            <label className="form-field__label" htmlFor="ft-grading-mode">
              {t('tasks.gradingMode')}
            </label>
            <select
              id="ft-grading-mode"
              className="form-field__control"
              value={form.gradingMode}
              onChange={(e) => setForm((f) => ({ ...f, gradingMode: e.target.value }))}
            >
              <option value={GRADING_MODES.AI}>{t('tasks.gradingModes.AI')}</option>
              <option value={GRADING_MODES.MANUAL}>{t('tasks.gradingModes.MANUAL')}</option>
              <option value={GRADING_MODES.NONE}>{t('tasks.gradingModes.NONE')}</option>
            </select>
            <p className="form-field__hint">{t('tasks.gradingModeHelp')}</p>
          </div>
          {form.gradingMode === GRADING_MODES.NONE ? (
            <p className="ft-manage-panel__desc" role="note">
              {t('tasks.noGradingNotice')}
            </p>
          ) : null}
          {form.gradingMode === GRADING_MODES.AI ? (
            <FormTextarea
              label={t('tasks.aiPrompt')}
              value={form.aiPrompt}
              onChange={(e) => setForm((f) => ({ ...f, aiPrompt: e.target.value }))}
              rows={3}
            />
          ) : null}
          <TaskInstructionFileField
            opportunityId={opportunityId}
            taskId={editingId}
            onUploaded={(fileId) => {
              setForm((f) => ({ ...f, instructionFileId: fileId }));
              setRemoveInstructionFile(false);
            }}
            onRemove={() => {
              setForm((f) => ({ ...f, instructionFileId: null }));
              if (editingId) setRemoveInstructionFile(true);
            }}
            onUploadingChange={setInstructionUploading}
          />
          {formError ? <p className="form-field__error">{formError}</p> : null}
          <div className="ft-manage-form-actions">
            <Button type="button" variant="outline" onClick={resetForm}>
              {t('cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={busy || !form.title.trim()}>
              {busy ? t('saving') : editingId ? t('save') : t('tasks.addTask')}
            </Button>
          </div>
        </form>
      ) : null}

      {downloadError ? <p className="form-field__error">{downloadError}</p> : null}

      {!tasks.length ? (
        <ManageTabEmpty
          icon={ListChecks}
          title={t('manageHub.noTasksTitle')}
          description={t('tasks.noTasks')}
          action={
            <Button type="button" variant="primary" onClick={() => setShowForm(true)}>
              <Plus size={14} aria-hidden />
              {t('tasks.addTask')}
            </Button>
          }
        />
      ) : (
        <ul className="ft-manage-task-list">
          {tasks.map((task) => {
            const count = submissionCountByTask[task.id] ?? 0;
            return (
              <li key={task.id} className="ft-manage-task-card">
                <div>
                  <h3>{task.title}</h3>
                  <p className="ft-manage-panel__desc">
                    {task.due_date
                      ? `${t('tasks.dueDate')}: ${formatFtDate(task.due_date)}`
                      : t('selfEval.noDueDate')}
                  </p>
                  <div className="ft-manage-task-card__badges">
                    {task.is_final_task ? (
                      <StatusBadge variant="warning">{t('tasks.finalTaskBadge')}</StatusBadge>
                    ) : null}
                    <StatusBadge variant={task.is_required === false ? 'muted' : 'warning'}>
                      {task.is_required === false ? t('tasks.optionalBadge') : t('tasks.requiredBadge')}
                    </StatusBadge>
                    <StatusBadge variant="info">
                      {t(gradingModeLabelKey(resolveTaskGradingMode(task)))}
                    </StatusBadge>
                    {task.has_instruction_file ? (
                      <StatusBadge variant="muted">{t('tasks.instructionFileBadge')}</StatusBadge>
                    ) : null}
                    <StatusBadge variant={count > 0 ? 'success' : 'muted'}>
                      {t('manageHub.submissionCount', { count })}
                    </StatusBadge>
                  </div>
                </div>
                <div className="ft-manage-inline-actions">
                  {task.has_instruction_file ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="btn--sm"
                      onClick={() => handleDownloadInstruction(task.id)}
                    >
                      <Download size={14} aria-hidden />
                      {t('tasks.downloadInstruction')}
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" className="btn--sm" onClick={() => startEdit(task)}>
                    <Pencil size={14} aria-hidden />
                    {t('edit')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="btn--sm"
                    disabled={mut.remove.isPending}
                    onClick={() => handleDelete(task.id)}
                  >
                    <Trash2 size={14} aria-hidden />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
