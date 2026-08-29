import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StudentStatusBadge } from './StudentStatusBadge.jsx';
import { trainingStatusVariant, TaskProgressBadge } from '../../features/fieldTraining/index.js';
import { deriveFieldTrainingNextAction } from '../../features/student/studentDashboard.helpers.js';

/**
 * Field-training summary card for student portal.
 */
export function StudentTrainingCard({ application, progress }) {
  const { t } = useTranslation(['dashboard', 'fieldTraining']);
  const opp = application?.opportunity || progress?.opportunity || {};
  const metrics = progress?.metrics ?? {};
  const next =
    progress?.next_action ||
    deriveFieldTrainingNextAction(application, {
      requires_pre_assessment: opp.requires_pre_assessment,
      requires_post_assessment: opp.requires_post_assessment,
    });

  const title = opp.title || t('dashboard:student.dashboard.fieldTraining.untitled');
  const to = `/student/field-training/${application.opportunity_id}`;
  const tp = application?.task_progress || progress?.task_progress;
  const tasksSubmitted = Number(
    metrics.submitted_required_tasks_count ?? metrics.tasks_submitted ?? 0
  );
  const tasksTotal = Number(metrics.required_tasks_count ?? metrics.tasks_count ?? 0);
  const attendance =
    application.attendance_percentage != null
      ? `${Math.round(Number(application.attendance_percentage))}%`
      : metrics.attendance_percentage != null
        ? `${Math.round(Number(metrics.attendance_percentage))}%`
        : t('dashboard:student.dashboard.fieldTraining.noAttendanceYet');

  const instructor =
    opp.instructor?.full_name ||
    application.instructor?.full_name ||
    opp.organization_name ||
    null;

  const metricItems = [
    {
      key: 'pre',
      label: t('dashboard:student.dashboard.fieldTraining.preScore'),
      value:
        application.pre_assessment_score != null
          ? `${application.pre_assessment_score}%`
          : t('dashboard:student.dashboard.fieldTraining.notYet'),
    },
    {
      key: 'attendance',
      label: t('dashboard:student.dashboard.fieldTraining.attendance'),
      value: attendance,
    },
    {
      key: 'tasks',
      label: t('dashboard:student.dashboard.fieldTraining.tasks'),
      value:
        tp?.display ||
        (tasksTotal > 0
          ? t('dashboard:student.dashboard.fieldTraining.tasksRatio', {
              submitted: tasksSubmitted,
              total: tasksTotal,
            })
          : t('dashboard:student.dashboard.fieldTraining.notYet')),
    },
    {
      key: 'post',
      label: t('dashboard:student.dashboard.fieldTraining.postScore'),
      value:
        application.post_assessment_score != null
          ? `${application.post_assessment_score}%`
          : t('dashboard:student.dashboard.fieldTraining.notYet'),
    },
    {
      key: 'eligibility',
      label: t('dashboard:student.dashboard.fieldTraining.eligibility'),
      value: t(
        `fieldTraining:eligibility.${application.completion_eligibility_status}`,
        application.completion_eligibility_status || 'pending'
      ),
    },
    {
      key: 'letter',
      label: t('dashboard:student.dashboard.fieldTraining.letter'),
      value: application.completion_letter_issued_at
        ? t('dashboard:student.dashboard.fieldTraining.letterIssued')
        : t('dashboard:student.dashboard.fieldTraining.letterPending'),
    },
  ];

  return (
    <article className="student-ft-card">
      <header className="student-ft-card__head">
        <h3 className="student-ft-card__title">{title}</h3>
        <div className="student-ft-card__badges">
          <StudentStatusBadge variant="muted">
            {t(`fieldTraining:applicationStatus.${application.status}`, application.status)}
          </StudentStatusBadge>
          {application.training_status && application.training_status !== 'none' ? (
            <StudentStatusBadge variant={trainingStatusVariant(application.training_status)}>
              {t(
                `fieldTraining:trainingStatus.${application.training_status}`,
                application.training_status
              )}
            </StudentStatusBadge>
          ) : null}
          <TaskProgressBadge
            progress={application.task_progress || progress?.task_progress}
          />
        </div>
      </header>

      <div className="student-ft-card__meta-row">
        {instructor ? (
          <p className="student-ft-card__meta-item">
            <span className="student-ft-card__meta-label">
              {t('dashboard:student.dashboard.fieldTraining.instructor')}
            </span>
            <span className="student-ft-card__meta-value">{instructor}</span>
          </p>
        ) : null}
        {opp.specialty?.name_ar || opp.specialty?.name_en ? (
          <p className="student-ft-card__meta-item">
            <span className="student-ft-card__meta-label">
              {t('dashboard:student.dashboard.fieldTraining.specialty')}
            </span>
            <span className="student-ft-card__meta-value">
              {opp.specialty.name_ar || opp.specialty.name_en}
            </span>
          </p>
        ) : null}
      </div>

      <div className="student-ft-card__metrics">
        {metricItems.map((m) => (
          <div key={m.key} className="student-ft-card__metric">
            <span className="student-ft-card__metric-label">{m.label}</span>
            <span className="student-ft-card__metric-value">{m.value}</span>
          </div>
        ))}
      </div>

      {next?.label_ar ? (
        <p className="student-ft-card__next" role="status">
          <strong>{t('dashboard:student.dashboard.fieldTraining.nextStep')}</strong>
          {next.label_ar}
        </p>
      ) : null}

      <footer className="student-ft-card__footer">
        <Link to={to} className="btn btn--primary btn--sm">
          {t('dashboard:student.dashboard.fieldTraining.continue')}
        </Link>
      </footer>
    </article>
  );
}

/** @deprecated Use StudentTrainingCard */
export const StudentFtDashCard = StudentTrainingCard;
