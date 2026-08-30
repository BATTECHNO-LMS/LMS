import { useTranslation } from 'react-i18next';
import { StatusBadge } from '../../../../components/admin/StatusBadge.jsx';
import { TrainingHoursProgressCard } from '../../../../components/fieldTraining/TrainingHoursProgressCard.jsx';
import { ClipboardCheck } from 'lucide-react';

function formatReasons(reason) {
  if (!reason) return [];
  if (Array.isArray(reason)) return reason.map(String).filter(Boolean);
  if (Array.isArray(reason?.reasons)) return reason.reasons.map(String);
  if (Array.isArray(reason?.details)) return reason.details.map(String);
  if (typeof reason === 'string') return [reason];
  if (typeof reason === 'object') {
    return Object.entries(reason).map(([k, v]) => `${k}: ${v}`);
  }
  return [];
}

export function StudentEligibilityTab({
  progress,
  application,
  opp,
  enabled,
  expelled,
}) {
  const { t } = useTranslation('fieldTraining');
  const metrics = progress?.metrics ?? {};
  const eligibility =
    metrics.completion_eligibility_status ?? application?.completion_eligibility_status ?? 'pending';
  const attendance = metrics.attendance_percentage ?? application?.attendance_percentage;
  const minAttendance = opp?.minimum_attendance_percentage;
  const postScore = metrics.post_assessment_score ?? application?.post_assessment_score;
  const minPost = opp?.minimum_post_assessment_score;
  const finalTask = metrics.final_task_status ?? application?.final_task_status ?? 'not_required';
  const reasons = formatReasons(application?.eligibility_reason);
  const aiRequired = Boolean(opp?.requires_final_task);
  const aiCompleted =
    metrics.ai_self_evaluation_completed ?? application?.ai_self_evaluation_completed ?? null;

  if (!enabled) {
    return <p className="ft-manage-empty">{t('studentTraining.completionLocked')}</p>;
  }

  return (
    <div className="ft-student-eligibility">
      <article className="ft-content-card">
        <header className="ft-content-card__head">
          <div className="ft-content-card__icon-wrap" aria-hidden>
            <ClipboardCheck size={18} />
          </div>
          <h3 className="ft-content-card__title">{t('studentTraining.eligibilityPanel.title')}</h3>
          <StatusBadge
            variant={
              expelled || eligibility === 'ineligible'
                ? 'danger'
                : eligibility === 'eligible'
                  ? 'success'
                  : 'warning'
            }
          >
            {expelled
              ? t('trainingStatus.expelled')
              : t(`eligibility.${eligibility}`, eligibility)}
          </StatusBadge>
        </header>

        <dl className="ft-overview-info__grid">
          <div>
            <dt>{t('progress.attendance')}</dt>
            <dd>
              {attendance != null ? `${attendance}%` : t('notAvailable')}
              {minAttendance != null ? ` / ${minAttendance}%` : ''}
            </dd>
          </div>
          <div>
            <dt>{t('hours.completed')}</dt>
            <dd>
              {metrics.completed_training_hours != null
                ? t('hours.completedDone', { count: metrics.completed_training_hours })
                : t('hours.notConfigured')}
            </dd>
          </div>
          {aiRequired ? (
            <div>
              <dt>{t('progress.task')}</dt>
              <dd>{t(`finalTaskStatus.${finalTask}`, finalTask)}</dd>
            </div>
          ) : null}
          <div>
            <dt>{t('progress.postScore')}</dt>
            <dd>
              {postScore != null ? postScore : t('notAvailable')}
              {minPost != null ? ` / ${minPost}` : ''}
            </dd>
          </div>
          {aiRequired ? (
            <div>
              <dt>{t('studentTraining.eligibilityPanel.aiCompleted')}</dt>
              <dd>
                {aiCompleted
                  ? t('studentTraining.eligibilityPanel.aiYes')
                  : t('studentTraining.eligibilityPanel.aiNo')}
              </dd>
            </div>
          ) : null}
        </dl>

        <TrainingHoursProgressCard
          hours={progress?.hours ?? metrics}
          className="ft-student-eligibility__hours"
        />

        {reasons.length ? (
          <ul className="ft-eligibility-reasons">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        ) : null}
      </article>
    </div>
  );
}
