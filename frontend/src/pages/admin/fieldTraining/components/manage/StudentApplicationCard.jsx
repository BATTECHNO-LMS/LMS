import {
  Award,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  Clock,
  GraduationCap,
  Mail,
  UserRound,
  UserX,
  XCircle,
} from 'lucide-react';
import { StatusBadge } from '../../../../../components/admin/StatusBadge.jsx';
import {
  applicationBadgeVariant,
  displayFieldValue,
  formatFtDate,
  getOpportunitySpecialtyLabel,
  getStudentInitials,
  trainingStatusVariant,
  TaskProgressBadge,
} from '../../../../../features/fieldTraining/index.js';

export function computeCardProgressPercent(app) {
  if (!app) return 0;
  if (app.status === 'pending') return 8;
  if (app.status === 'rejected' || app.status === 'cancelled') return 15;
  if (app.training_status === 'expelled' || app.training_status === 'failed') return 20;
  const map = {
    none: 22,
    pre_assessment_pending: 30,
    pre_assessment_completed: 40,
    ready_for_training: 45,
    in_training: 55,
    task_pending: 65,
    task_submitted: 72,
    post_assessment_pending: 80,
    post_assessment_completed: 88,
    eligible_for_completion: 94,
    completed: 100,
  };
  return map[app.training_status] ?? 25;
}

export function resolveJourneyLabelKey(app) {
  if (!app) return 'not_started';
  if (app.training_status === 'expelled') return 'expelled';
  if (app.status === 'pending') return 'pending_review';
  if (app.status === 'rejected') return 'rejected';
  if (app.completion_eligibility_status === 'ineligible' || app.training_status === 'failed') {
    return 'ineligible';
  }
  if (app.training_status === 'completed' || app.completion_letter_issued_at) return 'completed';
  if (
    app.completion_eligibility_status === 'eligible' ||
    app.training_status === 'eligible_for_completion'
  ) {
    return 'eligible';
  }
  if (app.training_status === 'task_submitted') return 'awaiting_review';
  if (app.training_status === 'task_pending') return 'awaiting_submission';
  if (app.training_status === 'pre_assessment_pending') return 'pre_assessment';
  if (
    ['in_training', 'post_assessment_pending', 'post_assessment_completed'].includes(app.training_status)
  ) {
    return 'in_training';
  }
  if (['none', 'ready_for_training', 'pre_assessment_completed'].includes(app.training_status)) {
    return 'not_started';
  }
  return 'not_started';
}

function journeyBadgeVariant(key) {
  if (key === 'completed' || key === 'eligible') return 'success';
  if (key === 'expelled' || key === 'rejected' || key === 'ineligible') return 'danger';
  if (key === 'awaiting_review' || key === 'pending_review') return 'warning';
  if (key === 'in_training' || key === 'pre_assessment') return 'info';
  return 'muted';
}

export function StudentApplicationCard({ app, t, i18n, onOpen, onApprove, onReject, onExpel, readOnly }) {
  const studentName = displayFieldValue(app.student_name, t('missingStudentName'));
  const studentEmail = displayFieldValue(app.student_email, t('missingStudentEmail'));
  const studentUniversity = displayFieldValue(app.student_university, t('missingStudentUniversity'));
  const studentProgram = displayFieldValue(
    app.student_university_specialty_label ||
      getOpportunitySpecialtyLabel({ specialty: app.student_university_specialty }, i18n.language, ''),
    t('missingStudentSpecialty')
  );
  const progress = computeCardProgressPercent(app);
  const journeyKey = resolveJourneyLabelKey(app);
  const isPending = app.status === 'pending';
  const canExpel =
    app.status === 'approved' && app.training_status !== 'expelled' && app.training_status !== 'completed';

  return (
    <article
      className={`ft-student-card ft-student-card--${app.status}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(app)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen?.(app);
        }
      }}
    >
      <header className="ft-student-card__head">
        <div className="ft-student-card__avatar" aria-hidden>
          {getStudentInitials(app.student_name)}
        </div>
        <div className="ft-student-card__identity">
          <h3 className="ft-student-card__name">{studentName}</h3>
          <p className="ft-student-card__email">
            <Mail size={13} aria-hidden />
            {studentEmail}
          </p>
        </div>
        <ChevronLeft className="ft-student-card__chevron" size={18} aria-hidden />
      </header>

      <div className="ft-student-card__meta">
        <span>
          <GraduationCap size={14} aria-hidden />
          {studentUniversity}
        </span>
        <span>
          <Briefcase size={14} aria-hidden />
          {studentProgram}
        </span>
        <span>
          <Clock size={14} aria-hidden />
          {formatFtDate(app.created_at) ?? '—'}
        </span>
      </div>

      <div className="ft-student-card__badges">
        <StatusBadge variant={applicationBadgeVariant(app.status)}>
          {t(`applicationStatus.${app.status}`)}
        </StatusBadge>
        <StatusBadge variant={journeyBadgeVariant(journeyKey)}>
          {t(`manageHub.studentCards.journey.${journeyKey}`)}
        </StatusBadge>
        {app.training_status && app.training_status !== 'none' ? (
          <StatusBadge variant={trainingStatusVariant(app.training_status)}>
            {t(`trainingStatus.${app.training_status}`, app.training_status)}
          </StatusBadge>
        ) : null}
        <TaskProgressBadge progress={app.task_progress} />
        {app.post_assessment_attempt_status_label ? (
          <StatusBadge
            variant={
              app.post_assessment_attempt_status === 'graded' ||
              app.post_assessment_attempt_status === 'submitted'
                ? 'success'
                : app.post_assessment_attempt_status === 'in_progress'
                  ? 'warning'
                  : 'muted'
            }
          >
            {app.post_assessment_attempt_status_label}
          </StatusBadge>
        ) : null}
      </div>

      <div className="ft-student-card__progress">
        <div className="ft-student-card__progress-top">
          <span>{t('manageHub.studentCards.progress')}</span>
          <strong>{progress}%</strong>
        </div>
        <div className="ft-student-card__progress-track" aria-hidden>
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      <footer
        className="ft-student-card__actions"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <button type="button" className="btn btn--outline btn--sm" onClick={() => onOpen?.(app)}>
          <UserRound size={14} aria-hidden />
          {t('manageHub.studentCards.viewDetails')}
        </button>
        {isPending && !readOnly ? (
          <>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => onApprove?.(app.id)}
            >
              <CheckCircle2 size={14} aria-hidden />
              {t('approve')}
            </button>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => onReject?.(app.id)}
            >
              <XCircle size={14} aria-hidden />
              {t('reject')}
            </button>
          </>
        ) : null}
        {canExpel ? (
          <button type="button" className="btn btn--outline btn--sm" onClick={() => onExpel?.(app)}>
            <UserX size={14} aria-hidden />
            {readOnly ? t('expel.requestAction') : t('expel.action')}
          </button>
        ) : null}
        {!readOnly &&
        app.completion_eligibility_status === 'eligible' &&
        !app.completion_letter_issued_at ? (
          <span className="ft-student-card__letter-hint">
            <Award size={14} aria-hidden />
            {t('manageHub.studentCards.readyForLetter')}
          </span>
        ) : null}
      </footer>
    </article>
  );
}
