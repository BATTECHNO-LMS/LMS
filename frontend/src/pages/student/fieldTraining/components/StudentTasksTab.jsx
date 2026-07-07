import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StudentFieldTrainingTasksPanel } from '../../../admin/fieldTraining/components/StudentFieldTrainingTasksPanel.jsx';

export function StudentTasksTab({ opportunityId, enabled, expelled }) {
  const { t } = useTranslation('fieldTraining');

  if (expelled) {
    return (
      <div className="ft-panel-locked ft-panel-locked--premium" role="status">
        <Lock size={40} aria-hidden />
        <h3>{t('studentTraining.expelledTitle')}</h3>
        <p>{t('studentTraining.tasksBlocked')}</p>
      </div>
    );
  }

  if (!enabled) {
    return <p className="ft-manage-empty">{t('studentTraining.tasksLocked')}</p>;
  }

  return <StudentFieldTrainingTasksPanel opportunityId={opportunityId} />;
}
