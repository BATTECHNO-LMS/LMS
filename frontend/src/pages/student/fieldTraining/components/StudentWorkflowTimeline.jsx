import { useMemo, useState } from 'react';
import {
  Check,
  Circle,
  FileText,
  Lock,
  Route,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const WORKFLOW_STEP_KEYS = [
  'application_submitted',
  'application_reviewed',
  'pre_assessment',
  'training_started',
  'sessions',
  'tasks',
  'post_assessment',
  'eligibility',
  'completion_letter',
];

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatDate(value, locale) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Build display metadata for a workflow step from real progress metrics.
 * Does not change step status — only presentation.
 */
export function buildWorkflowStepDetails({
  key,
  status,
  progress,
  application,
  opp,
  expelled,
  rejected,
  t,
  locale,
}) {
  const metrics = progress?.metrics ?? {};
  const app = application ?? progress?.application ?? {};
  const opportunity = progress?.opportunity ?? opp ?? {};
  const requiresPre =
    metrics.pre_assessment_required ?? Boolean(opportunity.requires_pre_assessment);
  const requiresPost =
    metrics.post_assessment_required ?? Boolean(opportunity.requires_post_assessment);

  let detail = null;
  let dateLabel = null;
  let visual = status;

  if (expelled && key !== 'application_submitted' && key !== 'application_reviewed') {
    visual = 'locked';
  } else if (rejected && key === 'application_reviewed') {
    visual = 'failed';
  } else if (status === 'completed') {
    visual = 'completed';
  } else if (status === 'current') {
    visual = 'current';
  } else {
    visual = 'pending';
  }

  switch (key) {
    case 'application_submitted':
      dateLabel = formatDate(app.created_at || app.submitted_at, locale);
      detail =
        visual === 'completed'
          ? t('studentTraining.workflowDetail.submitted')
          : t('studentTraining.workflowDetail.awaitingSubmit');
      break;
    case 'application_reviewed':
      dateLabel = formatDate(app.reviewed_at || app.approved_at || app.updated_at, locale);
      if (visual === 'failed' || rejected) {
        detail = app.rejection_reason
          ? t('studentTraining.workflowDetail.rejectedWithReason', { reason: app.rejection_reason })
          : t('studentTraining.workflowDetail.rejected');
      } else if (visual === 'completed') {
        detail = t('studentTraining.workflowDetail.approved');
      } else {
        detail = t('studentTraining.workflowDetail.awaitingReview');
      }
      break;
    case 'pre_assessment':
      if (!requiresPre) {
        detail = t('studentTraining.kpi.notRequired');
      } else if (metrics.pre_assessment_score != null) {
        detail = t('studentTraining.workflowDetail.preCompleted', {
          score: metrics.pre_assessment_score,
        });
      } else if (metrics.pre_assessment_published) {
        detail = t('studentTraining.kpi.assessmentAvailable');
      } else {
        detail = t('studentTraining.assessment.notPublished');
      }
      break;
    case 'training_started':
      dateLabel = formatDate(app.training_started_at, locale);
      detail =
        visual === 'completed'
          ? t('studentTraining.workflowDetail.trainingStarted')
          : t('studentTraining.workflowDetail.awaitTrainingStart');
      break;
    case 'sessions': {
      const pct = metrics.attendance_percentage;
      const sessionsCount = num(metrics.sessions_count);
      const required = num(metrics.required_sessions_count ?? metrics.total_required_sessions);
      if (sessionsCount <= 0 && required <= 0) {
        detail = t('studentTraining.workflowDetail.sessionsNotStarted');
      } else if (pct != null) {
        detail = t('studentTraining.workflowDetail.attendancePct', { pct });
      } else {
        detail = t('studentTraining.workflowDetail.attendanceNotRecorded');
      }
      break;
    }
    case 'tasks': {
      const submitted = num(metrics.tasks_submitted ?? metrics.submitted_tasks_count);
      const total = num(metrics.tasks_count ?? metrics.total_tasks_count);
      if (total <= 0) {
        detail = t('studentTraining.noTasks');
      } else if (submitted >= total && total > 0) {
        detail = t('studentTraining.workflowDetail.tasksDone', { submitted, total });
      } else {
        detail = t('studentTraining.workflowDetail.tasksPending', { submitted, total });
      }
      break;
    }
    case 'post_assessment':
      if (!requiresPost) {
        detail = t('studentTraining.kpi.notRequired');
      } else if (metrics.post_assessment_score != null) {
        detail = t('studentTraining.workflowDetail.postCompleted', {
          score: metrics.post_assessment_score,
        });
      } else if (metrics.post_assessment_published) {
        detail = t('studentTraining.kpi.assessmentAvailable');
      } else {
        detail = t('studentTraining.assessment.notPublished');
      }
      break;
    case 'eligibility': {
      const elig = metrics.completion_eligibility_status || app.completion_eligibility_status;
      if (!elig || elig === 'pending') {
        detail = t('studentTraining.workflowDetail.eligibilityPending');
      } else {
        detail = t(`eligibility.${elig}`, elig);
      }
      break;
    }
    case 'completion_letter':
      dateLabel = formatDate(
        metrics.completion_letter_issued_at || app.completion_letter_issued_at,
        locale
      );
      detail = dateLabel
        ? t('studentTraining.workflowDetail.letterIssued')
        : t('studentTraining.workflowDetail.letterPending');
      break;
    default:
      break;
  }

  if (expelled && visual === 'locked') {
    detail = t('studentTraining.workflowDetail.lockedByExpulsion');
  }

  return { visual, detail, dateLabel };
}

/**
 * Professional progress timeline for student field-training journey.
 */
export function StudentWorkflowTimeline({
  steps,
  progress,
  application,
  opp,
  expelled,
  rejected,
}) {
  const { t, i18n } = useTranslation('fieldTraining');
  const locale = i18n.language || 'ar';
  const stepMap = Object.fromEntries((steps ?? []).map((s) => [s.key, s.status]));

  const enriched = useMemo(
    () =>
      WORKFLOW_STEP_KEYS.map((key) => {
        const status = stepMap[key] ?? 'pending';
        const meta = buildWorkflowStepDetails({
          key,
          status,
          progress,
          application,
          opp,
          expelled,
          rejected,
          t,
          locale,
        });
        return { key, status, ...meta };
      }),
    [stepMap, progress, application, opp, expelled, rejected, t, locale]
  );

  const completedCount = enriched.filter((s) => s.visual === 'completed').length;
  const progressPct = Math.round((completedCount / WORKFLOW_STEP_KEYS.length) * 100);
  const currentStep = enriched.find((s) => s.visual === 'current') ?? null;
  const nextAction = progress?.next_action;

  return (
    <section className="ft-journey-timeline" aria-labelledby="ft-workflow-title">
      <header className="ft-journey-timeline__header">
        <div className="ft-journey-timeline__heading">
          <span className="ft-journey-timeline__heading-icon" aria-hidden>
            <Route size={18} strokeWidth={2} />
          </span>
          <h2 id="ft-workflow-title" className="ft-journey-timeline__title">
            {t('studentTraining.workflowTitle')}
          </h2>
        </div>

        <div className="ft-journey-timeline__summary" role="status">
          <div className="ft-journey-timeline__summary-item">
            <span className="ft-journey-timeline__summary-label">
              {t('studentTraining.workflowSummary.overall')}
            </span>
            <strong className="ft-journey-timeline__summary-value">{progressPct}%</strong>
          </div>
          <div className="ft-journey-timeline__summary-item">
            <span className="ft-journey-timeline__summary-label">
              {t('studentTraining.workflowSummary.current')}
            </span>
            <strong className="ft-journey-timeline__summary-value">
              {currentStep
                ? t(`studentTraining.workflowSteps.${currentStep.key}`)
                : expelled
                  ? t('studentTraining.expelledTitle')
                  : rejected
                    ? t('studentTraining.rejectedTitle')
                    : t('studentTraining.workflowSummary.none')}
            </strong>
          </div>
          <div className="ft-journey-timeline__summary-item">
            <span className="ft-journey-timeline__summary-label">
              {t('studentTraining.workflowSummary.next')}
            </span>
            <strong className="ft-journey-timeline__summary-value">
              {nextAction?.label_ar || t('studentTraining.workflowSummary.none')}
            </strong>
          </div>
          <div
            className="ft-journey-timeline__bar"
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('studentTraining.workflowSummary.overall')}
          >
            <span style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </header>

      <ol className="ft-journey-timeline__track">
        {enriched.map((step, index) => {
          const Icon =
            step.visual === 'completed'
              ? Check
              : step.visual === 'failed'
                ? X
                : step.visual === 'locked'
                  ? Lock
                  : Circle;
          const prevCompleted =
            index > 0 &&
            (enriched[index - 1].visual === 'completed' ||
              enriched[index - 1].visual === 'current');

          return (
            <li
              key={step.key}
              className={`ft-journey-timeline__step ft-journey-timeline__step--${step.visual}`}
              aria-current={step.visual === 'current' ? 'step' : undefined}
            >
              {index < enriched.length - 1 ? (
                <span
                  className={`ft-journey-timeline__connector${
                    step.visual === 'completed' || (step.visual === 'current' && prevCompleted)
                      ? ' ft-journey-timeline__connector--done'
                      : ''
                  }${step.visual === 'completed' ? ' ft-journey-timeline__connector--full' : ''}`}
                  aria-hidden
                />
              ) : null}

              <div className="ft-journey-timeline__node">
                <span className="ft-journey-timeline__dot" aria-hidden>
                  {step.visual === 'completed' || step.visual === 'failed' || step.visual === 'locked' ? (
                    <Icon size={16} strokeWidth={2.5} />
                  ) : (
                    <span className="ft-journey-timeline__index">{index + 1}</span>
                  )}
                </span>
              </div>

              <div className="ft-journey-timeline__body">
                <div className="ft-journey-timeline__label-row">
                  <span className="ft-journey-timeline__label">
                    {t(`studentTraining.workflowSteps.${step.key}`)}
                  </span>
                  {step.visual === 'current' ? (
                    <span className="ft-journey-timeline__badge">
                      {t('studentTraining.workflowSummary.currentBadge')}
                    </span>
                  ) : null}
                </div>
                <span className="ft-journey-timeline__status">
                  {t(`studentTraining.workflowStatus.${step.visual}`, {
                    defaultValue: step.visual,
                  })}
                </span>
                {step.detail ? (
                  <span className="ft-journey-timeline__detail">{step.detail}</span>
                ) : null}
                {step.dateLabel ? (
                  <span className="ft-journey-timeline__date">{step.dateLabel}</span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

const DESCRIPTION_PREVIEW_CHARS = 280;

/**
 * Opportunity description card with optional expand/collapse.
 */
export function StudentOpportunityDescription({ description }) {
  const { t } = useTranslation('fieldTraining');
  const [expanded, setExpanded] = useState(false);
  const text = String(description || '').trim();
  if (!text) return null;

  const needsToggle = text.length > DESCRIPTION_PREVIEW_CHARS;
  const display =
    !needsToggle || expanded ? text : `${text.slice(0, DESCRIPTION_PREVIEW_CHARS).trimEnd()}…`;
  const paragraphs = display.split(/\n+/).map((p) => p.trim()).filter(Boolean);

  return (
    <article className="ft-opportunity-desc">
      <header className="ft-opportunity-desc__head">
        <span className="ft-opportunity-desc__icon" aria-hidden>
          <FileText size={18} strokeWidth={2} />
        </span>
        <h3 className="ft-opportunity-desc__title">{t('student.sectionDescription')}</h3>
      </header>
      <div className="ft-opportunity-desc__body">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {needsToggle ? (
        <button
          type="button"
          className="btn btn--outline btn--sm ft-opportunity-desc__toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded
            ? t('studentTraining.descriptionCollapse')
            : t('studentTraining.descriptionExpand')}
        </button>
      ) : null}
    </article>
  );
}
