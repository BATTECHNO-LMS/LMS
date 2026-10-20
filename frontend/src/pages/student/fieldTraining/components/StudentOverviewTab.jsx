import { useTranslation } from 'react-i18next';
import { StatCard } from '../../../../components/common/StatCard.jsx';
import { AdminStatsGrid } from '../../../../components/admin/AdminStatsGrid.jsx';
import { StatusBadge } from '../../../../components/admin/StatusBadge.jsx';
import { TrainingHoursProgressCard } from '../../../../components/fieldTraining/TrainingHoursProgressCard.jsx';
import { trainingStatusVariant, TaskProgressBadge } from '../../../../features/fieldTraining/index.js';
import {
  StudentWorkflowTimeline,
  StudentOpportunityDescription,
} from './StudentWorkflowTimeline.jsx';
import { StudentReadinessMeter } from './StudentReadinessMeter.jsx';
import { StudentTrainingJourney } from './StudentTrainingJourney.jsx';
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

  const tp = progress?.task_progress;
  const tasksSubmitted = num(
    metrics.submitted_required_tasks_count ?? metrics.tasks_submitted ?? metrics.submitted_tasks_count
  );
  const tasksTotal = num(metrics.required_tasks_count ?? metrics.tasks_count ?? metrics.total_tasks_count);
  const tasksValue =
    tp?.display ||
    t('studentTraining.kpi.tasksRatio', {
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

export function StudentOverviewTab({
  progress,
  application,
  opp,
  expelled,
  rejected,
  readiness,
  journey,
  nextAction: nextActionProp,
  onNavigateTab,
}) {
  const { t } = useTranslation('fieldTraining');
  const nextAction = nextActionProp || progress?.next_action;
  const kpis = buildOverviewKpiDisplay(progress, opp, t);

  function handleNavigate(href) {
    if (typeof onNavigateTab === 'function' && href) onNavigateTab(href);
  }

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

      {!expelled && !rejected ? (
        <div className="ft-student-overview__intel">
          <StudentReadinessMeter readiness={readiness} />
          {!expelled && !rejected && nextAction?.label_ar ? (
            <div className="ft-next-action-card ft-next-action-card--accent" role="status">
              <strong>{t('studentTraining.nextStep')}</strong>
              <p>{nextAction.label_ar}</p>
              {nextAction.href ? (
                <button
                  type="button"
                  className="btn btn--sm btn--primary"
                  onClick={() => handleNavigate(nextAction.href)}
                >
                  {t('studentTraining.goToAction')}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {(application?.training_status && application.training_status !== 'none') ||
      progress?.task_progress ||
      application?.task_progress ? (
        <div className="ft-student-overview__status-row">
          {application?.training_status && application.training_status !== 'none' ? (
            <StatusBadge variant={trainingStatusVariant(application.training_status)}>
              {t(`trainingStatus.${application.training_status}`, application.training_status)}
            </StatusBadge>
          ) : null}
          <TaskProgressBadge progress={progress?.task_progress || application?.task_progress} />
          {application?.admin_note ? (
            <p className="ft-student-overview__admin-note">{application.admin_note}</p>
          ) : null}
        </div>
      ) : null}

      {!expelled && !rejected ? (
        <div className="ft-student-overview__phase2-cards">
          <button
            type="button"
            className="ft-phase2-card"
            onClick={() => handleNavigate('logbook')}
          >
            <strong>{t('logbook.title')}</strong>
            <p>{t('logbook.overviewCard')}</p>
            <span>{t('logbook.open')}</span>
          </button>
          <button
            type="button"
            className="ft-phase2-card"
            onClick={() => handleNavigate('portfolio')}
          >
            <strong>{t('portfolio.title')}</strong>
            <p>{t('portfolio.overviewCard')}</p>
            <span>{t('portfolio.open')}</span>
          </button>
        </div>
      ) : null}

      {!expelled && !rejected && journey ? (
        <StudentTrainingJourney
          journey={journey}
          onMilestoneClick={(m) => handleNavigate(m.href)}
        />
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

      <TrainingHoursProgressCard
        hours={progress?.hours ?? progress?.metrics}
        className="ft-student-overview__hours"
      />

      {!journey ? (
        <StudentWorkflowTimeline
          steps={progress?.steps}
          progress={progress}
          application={application}
          opp={opp}
          expelled={expelled}
          rejected={rejected}
        />
      ) : null}

      <StudentOpportunityDescription description={opp?.description} />
    </div>
  );
}
