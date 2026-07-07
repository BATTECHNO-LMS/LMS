import { useTranslation } from 'react-i18next';
import { StatCard } from '../../../../components/common/StatCard.jsx';
import { AdminStatsGrid } from '../../../../components/admin/AdminStatsGrid.jsx';
import { StatusBadge } from '../../../../components/admin/StatusBadge.jsx';
import { trainingStatusVariant } from '../../../../features/fieldTraining/index.js';
import { StudentWorkflowTimeline } from './StudentWorkflowTimeline.jsx';
import { ClipboardList, Calendar, Award, GraduationCap } from 'lucide-react';

export function StudentOverviewTab({ progress, application, opp, expelled, rejected }) {
  const { t } = useTranslation('fieldTraining');
  const metrics = progress?.metrics ?? {};
  const nextAction = progress?.next_action;

  return (
    <div className="ft-student-overview">
      {nextAction?.label_ar ? (
        <div className="ft-next-action-card" role="status">
          <strong>{t('studentTraining.nextAction')}</strong>
          <p>{nextAction.label_ar}</p>
        </div>
      ) : null}

      {application?.training_status && application.training_status !== 'none' ? (
        <div className="ft-student-overview__status-row">
          <StatusBadge variant={trainingStatusVariant(application.training_status)}>
            {t(`trainingStatus.${application.training_status}`, application.training_status)}
          </StatusBadge>
          {application.admin_note ? (
            <p className="ft-student-overview__admin-note">{application.admin_note}</p>
          ) : null}
        </div>
      ) : null}

      <AdminStatsGrid>
        <StatCard
          label={t('studentTraining.kpi.preScore')}
          value={metrics.pre_assessment_score != null ? `${metrics.pre_assessment_score}%` : '—'}
          hint={
            metrics.pre_assessment_level
              ? t(`knowledgeLevel.${metrics.pre_assessment_level}`)
              : t('studentTraining.kpi.notYet')
          }
          icon={GraduationCap}
        />
        <StatCard
          label={t('progress.attendance')}
          value={metrics.attendance_percentage != null ? `${metrics.attendance_percentage}%` : '—'}
          hint={t('studentTraining.kpi.attendanceHint')}
          icon={Calendar}
        />
        <StatCard
          label={t('studentTraining.kpi.tasksSubmitted')}
          value={
            metrics.tasks_submitted != null && metrics.tasks_count != null
              ? `${metrics.tasks_submitted}/${metrics.tasks_count}`
              : '—'
          }
          hint={t('studentTraining.kpi.tasksHint')}
          icon={ClipboardList}
        />
        <StatCard
          label={t('studentTraining.kpi.postScore')}
          value={metrics.post_assessment_score != null ? `${metrics.post_assessment_score}%` : '—'}
          hint={t('studentTraining.kpi.notYet')}
          icon={Award}
        />
      </AdminStatsGrid>

      <StudentWorkflowTimeline
        steps={progress?.steps}
        expelled={expelled}
        rejected={rejected}
      />

      {opp?.description ? (
        <article className="ft-content-card">
          <h3>{t('student.sectionDescription')}</h3>
          <p>{opp.description}</p>
        </article>
      ) : null}
    </div>
  );
}
