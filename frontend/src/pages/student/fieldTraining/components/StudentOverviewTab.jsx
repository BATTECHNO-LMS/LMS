import { useTranslation } from 'react-i18next';
import { StatCard } from '../../../../components/common/StatCard.jsx';
import { AdminStatsGrid } from '../../../../components/admin/AdminStatsGrid.jsx';
import { StatusBadge } from '../../../../components/admin/StatusBadge.jsx';
import { trainingStatusVariant } from '../../../../features/fieldTraining/index.js';
import {
  StudentWorkflowTimeline,
  StudentOpportunityDescription,
} from './StudentWorkflowTimeline.jsx';
import { ClipboardList, Calendar, Award, GraduationCap } from 'lucide-react';

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Map overview KPI cards from progress.metrics (snake_case API contract).
 */
export function buildOverviewKpiDisplay(progress, opp, t) {
  const metrics = progress?.metrics ?? {};
  const opportunity = progress?.opportunity ?? opp ?? {};
  const requiresPre =
    metrics.pre_assessment_required ?? Boolean(opportunity.requires_pre_assessment);
  const requiresPost =
    metrics.post_assessment_required ?? Boolean(opportunity.requires_post_assessment);

  const preScore = metrics.pre_assessment_score;
  const preLevel = metrics.pre_assessment_level;
  let preValue;
  let preHint = t('studentTraining.kpi.notYet');
  if (!requiresPre) {
    preValue = t('studentTraining.kpi.notRequired');
    preHint = t('studentTraining.kpi.preNotRequiredHint');
  } else if (preScore != null) {
    preValue = `${preScore}%`;
    preHint = preLevel
      ? t(`knowledgeLevel.${preLevel}`, preLevel)
      : t('studentTraining.kpi.completed');
  } else {
    preValue = t('studentTraining.kpi.assessmentNotSubmitted');
    preHint = metrics.pre_assessment_published
      ? t('studentTraining.kpi.assessmentAvailable')
      : t('studentTraining.assessment.notPublished');
  }

  const sessionsCount = num(metrics.sessions_count);
  const requiredSessions = num(
    metrics.required_sessions_count ?? metrics.total_required_sessions
  );
  const attended = num(metrics.sessions_attended ?? metrics.attended_sessions);
  const attendanceRecords = num(metrics.attendance_records_count);
  const attendancePct = metrics.attendance_percentage;
  let attendanceValue;
  let attendanceHint = t('studentTraining.kpi.attendanceHint');
  if (sessionsCount <= 0 && requiredSessions <= 0) {
    attendanceValue = t('studentTraining.kpi.sessionsNotStarted');
    attendanceHint = t('studentTraining.kpi.sessionsNotStartedHint');
  } else if (attendancePct != null) {
    attendanceValue = `${attendancePct}%`;
    attendanceHint = t('studentTraining.kpi.attendanceRatioHint', {
      attended,
      total: requiredSessions || sessionsCount,
    });
  } else if (attendanceRecords <= 0) {
    attendanceValue = t('studentTraining.kpi.attendanceNotRecorded');
    attendanceHint = t('studentTraining.kpi.attendanceNotRecordedHint', {
      total: requiredSessions || sessionsCount,
    });
  } else {
    attendanceValue = t('studentTraining.kpi.attendanceNotRecorded');
    attendanceHint = t('studentTraining.kpi.attendanceHint');
  }

  const tasksSubmitted = num(metrics.tasks_submitted ?? metrics.submitted_tasks_count);
  const tasksTotal = num(metrics.tasks_count ?? metrics.total_tasks_count);
  const tasksValue = t('studentTraining.kpi.tasksRatio', {
    submitted: tasksSubmitted,
    total: tasksTotal,
  });

  const postScore = metrics.post_assessment_score;
  const postPublished = Boolean(metrics.post_assessment_published);
  let postValue;
  let postHint = t('studentTraining.kpi.notYet');
  if (!requiresPost) {
    postValue = t('studentTraining.kpi.notRequired');
    postHint = t('studentTraining.kpi.postNotRequiredHint');
  } else if (postScore != null) {
    postValue = `${postScore}%`;
    if (metrics.post_assessment_passed === true) {
      postHint = t('studentTraining.kpi.postPassed');
    } else if (metrics.post_assessment_passed === false) {
      postHint = t('studentTraining.kpi.postNotPassed');
    } else {
      postHint = t('studentTraining.kpi.completed');
    }
  } else if (!postPublished) {
    postValue = t('studentTraining.kpi.notPublishedYet');
    postHint = t('studentTraining.assessment.notPublished');
  } else {
    postValue = t('studentTraining.kpi.assessmentNotSubmitted');
    postHint = t('studentTraining.kpi.assessmentAvailable');
  }

  return {
    pre: { value: preValue, hint: preHint },
    attendance: { value: attendanceValue, hint: attendanceHint },
    tasks: { value: tasksValue, hint: t('studentTraining.kpi.tasksHint') },
    post: { value: postValue, hint: postHint },
  };
}

export function StudentOverviewTab({ progress, application, opp, expelled, rejected }) {
  const { t } = useTranslation('fieldTraining');
  const nextAction = progress?.next_action;
  const kpis = buildOverviewKpiDisplay(progress, opp, t);

  return (
    <div className="ft-student-overview">
      {expelled ? (
        <div className="ft-next-action-card ft-next-action-card--danger" role="alert">
          <strong>{t('studentTraining.expelledTitle')}</strong>
          <p>{t('studentTraining.expelledText')}</p>
        </div>
      ) : null}

      {rejected ? (
        <div className="ft-next-action-card ft-next-action-card--danger" role="alert">
          <strong>{t('studentTraining.rejectedTitle')}</strong>
          <p>{t('studentTraining.rejectedText')}</p>
        </div>
      ) : null}

      {!expelled && !rejected && nextAction?.label_ar ? (
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
          value={kpis.pre.value}
          hint={kpis.pre.hint}
          icon={GraduationCap}
        />
        <StatCard
          label={t('progress.attendance')}
          value={kpis.attendance.value}
          hint={kpis.attendance.hint}
          icon={Calendar}
        />
        <StatCard
          label={t('studentTraining.kpi.tasksSubmitted')}
          value={kpis.tasks.value}
          hint={kpis.tasks.hint}
          icon={ClipboardList}
        />
        <StatCard
          label={t('studentTraining.kpi.postScore')}
          value={kpis.post.value}
          hint={kpis.post.hint}
          icon={Award}
        />
      </AdminStatsGrid>

      <StudentWorkflowTimeline
        steps={progress?.steps}
        progress={progress}
        application={application}
        opp={opp}
        expelled={expelled}
        rejected={rejected}
      />

      <StudentOpportunityDescription description={opp?.description} />
    </div>
  );
}
