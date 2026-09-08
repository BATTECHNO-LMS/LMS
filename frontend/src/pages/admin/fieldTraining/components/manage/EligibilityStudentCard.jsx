import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronDown, ChevronUp, FileText, RefreshCw, XCircle } from 'lucide-react';
import { StatusBadge } from '../../../../../components/admin/StatusBadge.jsx';
import { Button } from '../../../../../components/common/Button.jsx';

function eligibilityVariant(status) {
  if (status === 'eligible') return 'success';
  if (status === 'ineligible' || status === 'expelled') return 'danger';
  if (status === 'needs_review' || status === 'incomplete') return 'warning';
  return 'muted';
}

function formatPoints(value, max) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n} / ${max}`;
}

function GateIcon({ ok }) {
  if (ok === true) return <CheckCircle2 size={14} className="ft-elig-card__ok" aria-hidden />;
  if (ok === false) return <XCircle size={14} className="ft-elig-card__fail" aria-hidden />;
  return null;
}

function splitReason(label) {
  const text = String(label || '').trim();
  if (!text) return null;
  const parts = text.split('؛');
  if (parts.length > 1) {
    return { title: parts[0].trim(), detail: parts.slice(1).join('؛').trim() };
  }
  return { title: text, detail: null };
}

function scoreDiffLabel(finalScore, passing, t) {
  if (finalScore == null || passing == null) return null;
  const diff = Math.round((Number(finalScore) - Number(passing)) * 10) / 10;
  if (diff >= 0) return t('eligibilityCard.aboveThreshold', { count: diff });
  return t('eligibilityCard.belowThreshold', { count: Math.abs(diff) });
}

export function EligibilityStudentCard({
  row,
  opportunity,
  opportunityId,
  apiScope = 'admin',
  t,
  onRecalculate,
  recalcPending,
}) {
  const [showTasks, setShowTasks] = useState(false);
  const status =
    row.training_status === 'expelled' ? 'expelled' : row.eligibility_status || 'pending';
  const q = row.qualification || {};
  const components = q.scoreComponents || {};
  const gates = q.mandatoryRequirements || {};
  const passing = q.passingScore ?? 80;
  const finalScore = q.finalScore;
  const labels = (Array.isArray(q.eligibilityReasonLabels)
    ? q.eligibilityReasonLabels
    : Array.isArray(row.eligibility_reason?.labelsAr)
      ? row.eligibility_reason.labelsAr
      : []
  ).filter((label) => {
    if (status !== 'eligible') return true;
    // Never show stale failure reasons on approved eligible cards.
    return !/أقل من|لم يستكمل|غير مؤهل|تعذر|التقييم المهني غير مكتمل/.test(String(label || ''));
  });
  const breakdown = q.scoreBreakdown || {};
  const attendancePts = breakdown.attendancePoints ?? components.attendance?.points;
  const postPts = breakdown.postAssessmentPoints ?? components.postAssessment?.points;
  const taskPts = breakdown.taskPoints ?? components.tasks?.approvedPoints ?? components.tasks?.points;
  const behaviorPts = breakdown.behaviorPoints ?? components.behavior?.points;
  const taskAccepted =
    components.tasks?.acceptedCount ??
    row.task_progress?.accepted_required ??
    row.task_progress?.submitted_required ??
    null;
  const taskRequired =
    components.tasks?.requiredCount ??
    row.task_progress?.total_required ??
    null;
  const taskDetails = Array.isArray(components.tasks?.details) ? components.tasks.details : [];
  const hoursCompleted =
    row.training_hours?.completed_training_hours ??
    null;
  const hoursRequired =
    row.training_hours?.required_training_hours ??
    opportunity?.required_training_hours ??
    null;
  const reportBase =
    apiScope === 'instructor'
      ? `/instructor/field-training/${opportunityId}/students/${row.application_id}/report`
      : `/admin/field-training/${opportunityId}/students/${row.application_id}/report`;
  const canRecalc = row.training_status !== 'expelled';
  const isEligible = status === 'eligible';
  const zeroParticipation = Boolean(q.zeroParticipationApplied);
  const hasApprovedResult = Boolean(q.approvedEvaluationResult);
  const approvedEligible = isEligible && hasApprovedResult;
  const submittedTasks =
    q.submittedRequiredTaskCount ??
    components.tasks?.submittedCount ??
    row.task_progress?.submitted_required ??
    null;
  const rawTasksLabel =
    taskAccepted != null && taskRequired != null
      ? `${taskAccepted} / ${taskRequired}`
      : submittedTasks != null && taskRequired != null
        ? `${submittedTasks} / ${taskRequired}`
        : '—';
  const tasksGateOk = approvedEligible
    ? true
    : gates.requiredTasksCompleted ??
      (taskAccepted != null && taskRequired != null ? taskAccepted >= taskRequired : null);
  const eligibilityOverride = q.eligibilityOverride || null;
  const evalAttendance =
    components.attendance?.evaluationAttendancePercentage ??
    components.attendance?.effectivePercentage ??
    (zeroParticipation ? 0 : row.attendance_percentage);
  const recordedAttendance =
    q.recordedAttendancePercent ??
    components.attendance?.recordedAttendancePercentage ??
    components.attendance?.rawPercentage ??
    row.attendance_percentage;

  return (
    <li className="ft-content-card ft-elig-card">
      <header className="ft-elig-card__header">
        <div className="ft-elig-card__identity">
          <h3 className="ft-elig-card__name">{row.student_name}</h3>
          <p className="ft-elig-card__uni">{row.student_university || '—'}</p>
          <p className="ft-elig-card__spec">{row.student_university_specialty_label || '—'}</p>
          <p className="ft-elig-card__num">
            {t('eligibilityCard.universityNumber')}: {row.university_student_number || '—'}
          </p>
        </div>
        <div className="ft-elig-card__badges">
          <StatusBadge variant={eligibilityVariant(status)}>
            {status === 'expelled'
              ? t('trainingStatus.expelled')
              : t(`eligibility.${status}`, status)}
          </StatusBadge>
          {zeroParticipation ? (
            <StatusBadge variant="warning">{t('eligibilityCard.zeroParticipationBadge')}</StatusBadge>
          ) : null}
        </div>
      </header>

      {zeroParticipation ? (
        <p className="ft-elig-card__policy-note" role="status">
          {t('eligibilityCard.zeroParticipationNote')}
        </p>
      ) : null}
      {eligibilityOverride ? (
        <p className="ft-elig-card__policy-note" role="status">
          {eligibilityOverride.reasonAr || t('eligibilityCard.adminOverrideNote')}
        </p>
      ) : null}

      <section className="ft-elig-card__score" aria-label={t('scoreBreakdown.finalScore')}>
        <div className="ft-elig-card__score-main">
          <span>
            {q.approvedEvaluationResult
              ? t('eligibilityCard.approvedScore')
              : t('scoreBreakdown.finalScore')}
          </span>
          <strong>
            {finalScore != null ? `${finalScore} / 100` : '— / 100'}
          </strong>
        </div>
        {q.approvedSourceLabelAr || q.approvedEvaluationResult?.sourceLabelAr ? (
          <p className="ft-elig-card__pass">
            {t('eligibilityCard.approvedSource')}:{' '}
            {q.approvedSourceLabelAr || q.approvedEvaluationResult?.sourceLabelAr}
          </p>
        ) : null}
        <p className="ft-elig-card__pass">
          {t('eligibilityCard.thresholdLabel', { score: passing })}
        </p>
        {scoreDiffLabel(finalScore, passing, t) ? (
          <p className={`ft-elig-card__diff ${finalScore >= passing ? 'is-pass' : 'is-fail'}`}>
            {scoreDiffLabel(finalScore, passing, t)}
          </p>
        ) : null}
        <dl className="ft-elig-card__breakdown">
          <div>
            <dt>{t('eligibilityCard.attendancePoints')}</dt>
            <dd>{formatPoints(attendancePts, 20)}</dd>
          </div>
          <div>
            <dt>{t('eligibilityCard.postPoints')}</dt>
            <dd>{formatPoints(postPts, 20)}</dd>
          </div>
          <div>
            <dt>{t('eligibilityCard.tasksPoints')}</dt>
            <dd>{formatPoints(taskPts, 40)}</dd>
          </div>
          <div>
            <dt>{t('eligibilityCard.behaviorPoints')}</dt>
            <dd>{formatPoints(behaviorPts, 20)}</dd>
          </div>
          <div className="ft-elig-card__total">
            <dt>{t('eligibilityCard.total')}</dt>
            <dd>{finalScore != null ? `${finalScore} / 100` : '— / 100'}</dd>
          </div>
        </dl>
      </section>

      <section className="ft-elig-card__reqs">
        <h4>{t('eligibilityCard.requirements')}</h4>
        <ul>
          <li>
            <GateIcon ok={gates.attendanceRequirementMet ?? null} />
            <span>
              {zeroParticipation
                ? t('eligibilityCard.evaluationAttendance')
                : t('progress.attendance')}
            </span>
            <strong>{evalAttendance != null ? `${evalAttendance}%` : '—'}</strong>
          </li>
          {zeroParticipation && recordedAttendance != null && Number(recordedAttendance) !== 0 ? (
            <li>
              <span>{t('eligibilityCard.recordedAttendance')}</span>
              <strong>{`${recordedAttendance}%`}</strong>
            </li>
          ) : null}
          <li>
            <GateIcon ok={gates.hoursRequirementMet ?? (hoursCompleted != null && hoursRequired != null ? hoursCompleted >= hoursRequired : null)} />
            <span>{t('hours.title')}</span>
            <strong>
              {hoursCompleted != null && hoursRequired != null
                ? `${hoursCompleted} / ${hoursRequired}`
                : hoursCompleted != null
                  ? hoursCompleted
                  : '—'}
            </strong>
          </li>
          <li>
            <GateIcon ok={tasksGateOk} />
            <span>
              {approvedEligible
                ? t('eligibilityCard.approvedTasksEvaluation')
                : t('eligibilityCard.tasksCompletedLabel')}
            </span>
            <strong>
              {approvedEligible && taskPts != null
                ? `${taskPts} / 40`
                : rawTasksLabel}
            </strong>
          </li>
          {approvedEligible && rawTasksLabel !== '—' ? (
            <li>
              <span>{t('eligibilityCard.recordedTasksSubmissions')}</span>
              <strong>{rawTasksLabel}</strong>
            </li>
          ) : null}
          <li>
            <GateIcon ok={gates.preAssessmentCompleted ?? (row.pre_assessment_score != null)} />
            <span>{t('eligibilityCard.preAssessment')}</span>
            <strong>
              {row.pre_assessment_score != null
                ? t('eligibilityCard.completed')
                : t('eligibilityCard.incomplete')}
            </strong>
          </li>
          <li>
            <GateIcon ok={gates.postAssessmentCompleted ?? (row.post_assessment_score != null)} />
            <span>{t('eligibilityCard.postAssessment')}</span>
            <strong>
              {row.post_assessment_score != null
                ? `${row.post_assessment_score} / 100`
                : t('eligibilityCard.incomplete')}
            </strong>
          </li>
          <li>
            <GateIcon ok={gates.behaviorEvaluationComplete ?? (components.behavior?.professionalTotal != null)} />
            <span>{t('eligibilityCard.behavior')}</span>
            <strong>
              {components.behavior?.professionalTotal != null
                ? `${components.behavior.professionalTotal} / 50`
                : '—'}
            </strong>
          </li>
        </ul>
        {taskDetails.length ? (
          <div className="ft-elig-card__task-toggle">
            <button type="button" className="btn btn--link btn--sm" onClick={() => setShowTasks((v) => !v)}>
              {showTasks ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {t('eligibilityCard.showDetails')}
            </button>
            {showTasks ? (
              <ul className="ft-elig-card__task-list">
                {taskDetails.map((task, idx) => (
                  <li key={task.taskId || idx}>
                    <span>{task.title || t('scoreBreakdown.untitledTask')}</span>
                    <strong>
                      {task.submissionStatus === 'SUBMITTED' || task.accepted
                        ? `${t('eligibilityCard.completed')} — ${
                            task.approvedTaskScore != null
                              ? `${task.approvedTaskScore}/100`
                              : task.normalizedPercent != null
                                ? `${task.normalizedPercent}/100`
                                : '—'
                          }`
                        : t('tasks.reviewStatuses.not_submitted', 'غير مسلّم')}
                    </strong>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      {isEligible ? (
        <section className="ft-elig-card__success">
          <h4>{t('eligibilityCard.requirementsMet')}</h4>
          <ul>
            {approvedEligible
              ? [
                  t('eligibilityCard.passApprovedResult'),
                  t('eligibilityCard.passScore'),
                ].map((line) => <li key={line}>✓ {line}</li>)
              : (q.confirmedPasses || []).length
                ? (q.confirmedPasses || []).map((line) => <li key={line}>✓ {line}</li>)
                : [
                    gates.scorePassed ? t('eligibilityCard.passScore') : null,
                    gates.hoursRequirementMet ? t('eligibilityCard.passHours') : null,
                    gates.attendanceRequirementMet ? t('eligibilityCard.passAttendance') : null,
                    gates.requiredTasksCompleted ? t('eligibilityCard.passTasks') : null,
                    gates.preAssessmentCompleted && gates.postAssessmentCompleted
                      ? t('eligibilityCard.passAssessments')
                      : null,
                  ]
                    .filter(Boolean)
                    .map((line) => <li key={line}>✓ {line}</li>)}
          </ul>
        </section>
      ) : labels.length ? (
        <section className="ft-elig-card__reasons">
          <h4>{t('scoreBreakdown.mandatoryReasons')}</h4>
          <ul>
            {labels.map((label) => {
              const parsed = splitReason(label);
              if (!parsed) return null;
              return (
                <li key={label}>
                  <span className="ft-elig-card__reason-mark" aria-hidden>
                    ❌
                  </span>
                  <div>
                    <strong>{parsed.title}</strong>
                    {parsed.detail ? <p>{parsed.detail}</p> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <footer className="ft-elig-card__actions">
        {canRecalc ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={recalcPending}
            onClick={() => onRecalculate?.(row.application_id)}
          >
            <RefreshCw size={14} aria-hidden />
            {t('manageHub.studentCards.recalculateEligibility')}
          </Button>
        ) : null}
        <Link className="btn btn--primary btn--sm" to={reportBase}>
          <FileText size={14} aria-hidden />
          {t('eligibilityCard.comprehensiveReport')}
        </Link>
      </footer>
    </li>
  );
}
