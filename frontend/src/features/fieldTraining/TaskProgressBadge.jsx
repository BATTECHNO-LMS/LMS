import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import { useTranslation } from 'react-i18next';
import { taskProgressVariant } from './fieldTrainingUi.js';

/**
 * Backend-derived required-task progress. Never compute counts on the client.
 */
export function TaskProgressBadge({ progress, showDisplay = true }) {
  const { t } = useTranslation('fieldTraining');
  if (!progress) return null;
  const status = progress.primary_status === 'cancelled' ? 'cancelled' : progress.status;
  if (!status) return null;
  const label = showDisplay
    ? progress.display || t(`taskProgress.${status}`, status)
    : t(`taskProgress.${status}`, progress.label_ar || status);
  return (
    <StatusBadge variant={taskProgressVariant(status)} className="ft-task-progress-badge">
      {label}
    </StatusBadge>
  );
}

export function resolveTaskProgress(entity) {
  return entity?.task_progress || entity?.my_task_progress || entity?.progress?.task_progress || null;
}
