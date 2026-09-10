import { formatScore } from '../fieldTrainingTaskSemantics.js';

function formatPoints(value, max, empty = 'لا توجد') {
  return formatScore(value, max, empty);
}

function statusLabel(qualification, t) {
  const status = qualification?.workflowOutcome || qualification?.eligibilityStatus;
  if (status === 'eligible' || status === 'ELIGIBLE') return t('eligibility.eligible');
  if (status === 'needs_review' || status === 'NEEDS_REVIEW' || status === 'INCOMPLETE') {
    return t('eligibility.incomplete');
  }
  if (status === 'ineligible' || status === 'NOT_ELIGIBLE') return t('eligibility.ineligible');
  return t('eligibility.pending');
}

function statusVariant(qualification) {
  const status = qualification?.workflowOutcome || qualification?.eligibilityStatus;
  if (status === 'eligible' || status === 'ELIGIBLE') return 'success';
  if (status === 'needs_review' || status === 'NEEDS_REVIEW' || status === 'INCOMPLETE') return 'warning';
  if (status === 'ineligible' || status === 'NOT_ELIGIBLE') return 'danger';
  return 'muted';
}

export function FieldTrainingScoreBreakdown({ qualification, t, StatusBadge, tasks = [] }) {
  if (!qualification) return null;
  const components = qualification.scoreComponents || {};
  const passing = qualification.passingScore ?? 80;
  const reasons = qualification.eligibilityReasonLabels || [];
  const taskDetails = components.tasks?.details || [];
  const byId = new Map(tasks.map((row) => [String(row.task_id || row.id), row]));

  return (
    <section className="ft-score-breakdown">
      <div className="ft-score-breakdown__head">
        <div>
          <p className="ft-score-breakdown__label">{t('scoreBreakdown.finalScore')}</p>
          <strong className="ft-score-breakdown__final" dir="ltr">
            {qualification.finalScore != null ? formatScore(qualification.finalScore, 100) : t('common.unavailable', 'غير متوفر')}
          </strong>
        </div>
        {StatusBadge ? (
          <StatusBadge variant={statusVariant(qualification)}>{statusLabel(qualification, t)}</StatusBadge>
        ) : (
          <span>{statusLabel(qualification, t)}</span>
        )}
      </div>
      <p className="ft-score-breakdown__pass">{t('scoreBreakdown.passingScore', { score: passing })}</p>
      <dl className="ft-score-breakdown__grid">
        <div>
          <dt>{t('scoreBreakdown.attendance')}</dt>
          <dd dir="ltr">{formatPoints(components.attendance?.points, components.attendance?.maxPoints || 20)}</dd>
        </div>
        <div>
          <dt>{t('scoreBreakdown.postAssessment')}</dt>
          <dd dir="ltr">{formatPoints(components.postAssessment?.points, components.postAssessment?.maxPoints || 20)}</dd>
        </div>
        <div>
          <dt>{t('scoreBreakdown.tasks')}</dt>
          <dd dir="ltr">{formatPoints(components.tasks?.points, components.tasks?.maxPoints || 40)}</dd>
        </div>
        <div>
          <dt>{t('scoreBreakdown.behavior')}</dt>
          <dd dir="ltr">{formatPoints(components.behavior?.points, components.behavior?.maxPoints || 20)}</dd>
        </div>
      </dl>
      <div className="ft-score-breakdown__behavior">
        <p>
          {t('scoreBreakdown.professionalTotal')}:{' '}
          <span dir="ltr">
            {components.behavior?.professionalTotal != null
              ? formatScore(components.behavior.professionalTotal, components.behavior.professionalMax || 50)
              : t('common.unavailable', 'غير متوفر')}
          </span>
        </p>
        <p>
          {t('scoreBreakdown.professionalPercent')}:{' '}
          {components.behavior?.rawPercentage != null ? `${components.behavior.rawPercentage}%` : t('common.unavailable', 'غير متوفر')}
        </p>
        <p>
          {t('scoreBreakdown.behaviorContribution')}:{' '}
          <span dir="ltr">{formatPoints(components.behavior?.points, components.behavior?.maxPoints || 20)}</span>
        </p>
      </div>
      {taskDetails.length ? (
        <div className="ft-score-breakdown__tasks">
          <h4>{t('scoreBreakdown.taskDetails')}</h4>
          <ul>
            {taskDetails.map((row) => {
              const meta = byId.get(String(row.taskId)) || {};
              const submitted = row.submissionStatus === 'SUBMITTED' || Boolean(meta.submission);
              const score = row.approvedTaskScore ?? row.rawScore;
              return (
                <li key={row.taskId || row.title}>
                  <strong>{row.title || meta.task_title || t('scoreBreakdown.untitledTask')}</strong>
                  <span>
                    {t('scoreBreakdown.grade')}:{' '}
                    <span dir="ltr">
                      {submitted && score != null && row.maxScore != null
                        ? formatScore(score, row.maxScore)
                        : t('scoreBreakdown.noGrade')}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {reasons.length ? (
        <div className="ft-score-breakdown__reasons">
          <h4>{t('scoreBreakdown.mandatoryReasons')}</h4>
          <ul>
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
