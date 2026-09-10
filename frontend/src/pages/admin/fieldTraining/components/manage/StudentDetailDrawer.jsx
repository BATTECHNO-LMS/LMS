import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Phone,
  RefreshCw,
  UserX,
  X,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../../../components/common/Button.jsx';
import { StatusBadge } from '../../../../../components/admin/StatusBadge.jsx';
import {
  applicationBadgeVariant,
  displayFieldValue,
  downloadAdminCompletionLetter,
  formatFtDate,
  getOpportunitySpecialtyLabel,
  issueCompletionLetter,
  previewAdminCompletionLetter,
  recalculateApplicationEligibility,
  updateAcademicSupervisorName,
  useApplicationProgress,
  TaskProgressBadge,
} from '../../../../../features/fieldTraining/index.js';
import { formatScore, resolveTaskPresentation } from '../../../../../features/fieldTraining/fieldTrainingTaskSemantics.js';
import { fieldTrainingKeys } from '../../../../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';
import { getApiErrorMessage } from '../../../../../services/apiHelpers.js';
import { ManageTabError, ManageTabSkeleton } from './ManageTabStates.jsx';
import { computeCardProgressPercent, resolveJourneyLabelKey } from './StudentApplicationCard.jsx';
import { FieldTrainingScoreBreakdown } from '../../../../../features/fieldTraining/components/FieldTrainingScoreBreakdown.jsx';
import { ApplicationHoursPanel } from './ApplicationHoursPanel.jsx';

const WORKFLOW_STEPS = [
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

function MetricTile({ label, value, empty = 'غير متوفر' }) {
  const shown = value == null || value === '' ? empty : value;
  return (
    <div className="ft-student-drawer__metric">
      <span>{label}</span>
      <strong>{shown}</strong>
    </div>
  );
}

function stepVariant(status) {
  if (status === 'completed') return 'success';
  if (status === 'current') return 'warning';
  return 'muted';
}

export function StudentDetailDrawer({
  app,
  open,
  onClose,
  opportunityId,
  apiScope = 'admin',
  readOnly = false,
  onApprove,
  onReject,
  onExpel,
}) {
  const isInstructor = apiScope === 'instructor';
  const listBase = isInstructor ? '/instructor/field-training' : '/admin/field-training';
  const { t, i18n } = useTranslation('fieldTraining');
  const qc = useQueryClient();
  const [actionError, setActionError] = useState('');
  const [actionOk, setActionOk] = useState('');
  const [supervisorDraft, setSupervisorDraft] = useState(app?.academic_supervisor_name || '');

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useApplicationProgress(app?.id, {
    enabled: open && Boolean(app?.id),
    scope: apiScope,
  });

  useEffect(() => {
    if (open) setSupervisorDraft(app?.academic_supervisor_name || '');
  }, [open, app?.academic_supervisor_name]);

  useEffect(() => {
    if (!open) {
      setActionError('');
      setActionOk('');
      return undefined;
    }
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const issueMut = useMutation({
    mutationFn: () => issueCompletionLetter(app.id),
    onSuccess: () => {
      setActionOk(t('manageHub.studentCards.letterIssuedOk'));
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.adminApplications(opportunityId) });
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.applicationProgress(app.id) });
    },
    onError: (err) => setActionError(getApiErrorMessage(err)),
  });

  const recalcMut = useMutation({
    mutationFn: () =>
      recalculateApplicationEligibility(app.id, { asInstructor: isInstructor }),
    onSuccess: () => {
      setActionOk(t('manageHub.studentCards.eligibilityRecalcOk'));
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.adminApplications(opportunityId) });
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.applicationProgress(app.id) });
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.eligibility(opportunityId, apiScope) });
    },
    onError: (err) => setActionError(getApiErrorMessage(err)),
  });

  const supervisorMut = useMutation({
    mutationFn: () =>
      updateAcademicSupervisorName(app.id, { academic_supervisor_name: supervisorDraft }),
    onSuccess: (result) => {
      setActionOk(t('manageHub.studentCards.supervisorSaved'));
      setSupervisorDraft(result?.academic_supervisor_name || '');
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.adminApplications(opportunityId) });
      qc.invalidateQueries({ queryKey: ['ft-supervisor-groups'] });
    },
    onError: (err) => setActionError(getApiErrorMessage(err)),
  });

  const downloadMut = useMutation({
    mutationFn: () => downloadAdminCompletionLetter(app.id, { asInstructor: isInstructor }),
    onError: (err) => setActionError(getApiErrorMessage(err)),
  });

  const previewMut = useMutation({
    mutationFn: () => previewAdminCompletionLetter(app.id, { asInstructor: isInstructor }),
    onError: (err) => setActionError(getApiErrorMessage(err)),
  });

  if (!open || !app) return null;

  const progress = data?.progress;
  const student = data?.student;
  const metrics = progress?.metrics ?? {};
  const steps = progress?.steps?.length
    ? progress.steps
    : WORKFLOW_STEPS.map((key) => ({ key, status: 'pending' }));
  const attendanceRecords = data?.attendance?.records ?? [];
  const taskRows = data?.tasks ?? [];
  const assessments = data?.assessments ?? {};
  const letter = data?.completion_letter;
  const journeyKey = resolveJourneyLabelKey(app);
  const percent = computeCardProgressPercent(app);

  const studentName = displayFieldValue(
    student?.full_name || app.student_name,
    t('missingStudentName')
  );
  const studentEmail = displayFieldValue(student?.email || app.student_email, t('missingStudentEmail'));
  const studentUniversity = displayFieldValue(
    student?.university || app.student_university,
    t('missingStudentUniversity')
  );
  const studentProgram = displayFieldValue(
    student?.specialty_label ||
      app.student_university_specialty_label ||
      getOpportunitySpecialtyLabel({ specialty: app.student_university_specialty }, i18n.language, ''),
    t('missingStudentSpecialty')
  );
  const phone = student?.phone || app.student_phone;

  const canApproveReject = !readOnly && app.status === 'pending';
  const canExpel =
    app.status === 'approved' && app.training_status !== 'expelled' && app.training_status !== 'completed';
  const letterGate = progress?.metrics?.completion_letter_gate;
  const canIssueLetter =
    !readOnly &&
    (letterGate ? letterGate.allowed : app.completion_eligibility_status === 'eligible') &&
    !app.completion_letter_issued_at &&
    app.training_status !== 'expelled';
  const canRecalc =
    !readOnly &&
    apiScope !== 'reviewer' &&
    app.status === 'approved' &&
    app.training_status !== 'expelled';
  const canDownloadLetter = Boolean(letter?.has_pdf || app.completion_letter_issued_at);
  const canPreviewLetter = Boolean(letterGate?.allowed || canDownloadLetter);
  const canEditSupervisor = !readOnly && !isInstructor;

  return (
    <div className="ft-student-drawer-root" role="presentation">
      <button type="button" className="ft-student-drawer__backdrop" aria-label={t('cancel')} onClick={onClose} />
      <aside
        className="ft-student-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ft-student-drawer-title"
      >
        <header className="ft-student-drawer__header">
          <div>
            <p className="ft-student-drawer__eyebrow">{t('manageHub.studentCards.drawerTitle')}</p>
            <h2 id="ft-student-drawer-title" className="ft-student-drawer__title">
              {studentName}
            </h2>
            <div className="ft-student-drawer__badges">
              <StatusBadge variant={applicationBadgeVariant(app.status)}>
                {t(`applicationStatus.${app.status}`)}
              </StatusBadge>
              <StatusBadge variant="info">
                {t(`manageHub.studentCards.journey.${journeyKey}`)}
              </StatusBadge>
              <TaskProgressBadge progress={app.task_progress || progress?.task_progress} />
            </div>
          </div>
          <button type="button" className="btn btn--icon" onClick={onClose} aria-label={t('cancel')}>
            <X size={18} />
          </button>
        </header>

        <div className="ft-student-drawer__body">
          {isLoading ? <ManageTabSkeleton rows={5} /> : null}
          {isError ? (
            <ManageTabError message={getApiErrorMessage(error)} onRetry={() => refetch()} />
          ) : null}

          {!isLoading && !isError ? (
            <>
              <section className="ft-student-drawer__section">
                <h3>{t('manageHub.studentCards.basicInfo')}</h3>
                <dl className="ft-student-drawer__info-grid">
                  <div>
                    <dt>{t('table.student')}</dt>
                    <dd>{studentName}</dd>
                  </div>
                  <div>
                    <dt>{t('manageHub.studentCards.email')}</dt>
                    <dd>{studentEmail}</dd>
                  </div>
                  <div>
                    <dt>{t('manageHub.studentCards.university')}</dt>
                    <dd>{studentUniversity}</dd>
                  </div>
                  <div>
                    <dt>{t('manageHub.studentCards.specialty')}</dt>
                    <dd>{studentProgram}</dd>
                  </div>
                  <div>
                    <dt>{t('manageHub.studentCards.academicSupervisor')}</dt>
                    <dd>
                      {canEditSupervisor ? (
                        <form
                          className="ft-student-drawer__supervisor-form"
                          onSubmit={(e) => {
                            e.preventDefault();
                            supervisorMut.mutate();
                          }}
                        >
                          <input
                            value={supervisorDraft}
                            onChange={(e) => setSupervisorDraft(e.target.value)}
                            placeholder={t('manageHub.studentCards.unassignedSupervisor')}
                          />
                          <Button type="submit" variant="outline" size="sm" loading={supervisorMut.isPending}>
                            {t('manageHub.studentCards.saveSupervisor')}
                          </Button>
                        </form>
                      ) : (
                        app.academic_supervisor_name || t('manageHub.studentCards.unassignedSupervisor')
                      )}
                    </dd>
                  </div>
                  {phone ? (
                    <div>
                      <dt>
                        <Phone size={12} aria-hidden /> {t('manageHub.studentCards.phone')}
                      </dt>
                      <dd>{phone}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>{t('table.appliedAt')}</dt>
                    <dd>{formatFtDate(app.created_at) ?? t('common.unavailable', 'غير متوفر')}</dd>
                  </div>
                </dl>
              </section>

              <section className="ft-student-drawer__section">
                <h3>{t('form.completedTrainingHours')}</h3>
                <ApplicationHoursPanel
                  applicationId={app.id}
                  hours={data?.hours || data?.progress?.metrics || {}}
                  asInstructor={isInstructor}
                  canEdit={
                    !readOnly &&
                    apiScope !== 'reviewer' &&
                    app.status === 'approved' &&
                    app.training_status !== 'expelled'
                  }
                  onUpdated={() => {
                    setActionOk(t('form.hoursSaved'));
                    refetch();
                    qc.invalidateQueries({
                      queryKey: fieldTrainingKeys.adminApplications(opportunityId),
                    });
                  }}
                />
              </section>

              <section className="ft-student-drawer__section">
                <h3>{t('scoreBreakdown.finalScore')}</h3>
                <FieldTrainingScoreBreakdown
                  qualification={data?.qualification}
                  t={t}
                  StatusBadge={StatusBadge}
                  tasks={taskRows}
                />
              </section>

              <section className="ft-student-drawer__section">
                <div className="ft-student-drawer__section-head">
                  <h3>{t('manageHub.studentCards.journeyTitle')}</h3>
                  <strong>{percent}%</strong>
                </div>
                <div className="ft-student-card__progress-track ft-student-drawer__progress-track" aria-hidden>
                  <span style={{ width: `${percent}%` }} />
                </div>
                <ol className="ft-student-drawer__timeline">
                  {steps.map((step) => (
                    <li
                      key={step.key}
                      className={`ft-student-drawer__step ft-student-drawer__step--${step.status}`}
                    >
                      <span className="ft-student-drawer__step-dot" aria-hidden />
                      <div>
                        <strong>
                          {t(`student.workflowSteps.${step.key}`, step.key)}
                        </strong>
                        <StatusBadge variant={stepVariant(step.status)}>
                          {t(`manageHub.studentCards.stepStatus.${step.status}`, step.status)}
                        </StatusBadge>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="ft-student-drawer__section">
                <h3>{t('manageHub.studentCards.quickMetrics')}</h3>
                <div className="ft-student-drawer__metrics">
                  <MetricTile
                    label={t('progress.attendance')}
                    value={
                      metrics.attendance_percentage != null
                        ? `${metrics.attendance_percentage}%`
                        : null
                    }
                  />
                  <MetricTile
                    label={t('hours.required')}
                    value={metrics.required_training_hours}
                  />
                  <MetricTile
                    label={t('hours.completed')}
                    value={
                      metrics.completed_training_hours != null
                        ? t('hours.completedDone', { count: metrics.completed_training_hours })
                        : null
                    }
                  />
                  <MetricTile
                    label={t('hours.percentage')}
                    value={
                      metrics.hours_completion_percentage != null
                        ? `${metrics.hours_completion_percentage}%`
                        : null
                    }
                  />
                  <MetricTile
                    label={t('manageHub.studentCards.sessionsAttended')}
                    value={metrics.sessions_attended}
                  />
                  <MetricTile label={t('manageHub.studentCards.absences')} value={metrics.absent_count} />
                  <MetricTile
                    label={t('taskProgress.label')}
                    value={
                      app.task_progress?.display ||
                      progress?.task_progress?.display ||
                      metrics.task_progress_display
                    }
                  />
                  <MetricTile label={t('manageHub.studentCards.tasksTotal')} value={metrics.required_tasks_count ?? metrics.tasks_count} />
                  <MetricTile
                    label={t('manageHub.studentCards.tasksSubmitted')}
                    value={metrics.submitted_required_tasks_count ?? metrics.tasks_submitted}
                  />
                  <MetricTile
                    label={t('manageHub.kpi.pendingReviews')}
                    value={metrics.pending_reviews}
                  />
                  <MetricTile
                    label={t('manageHub.studentCards.preScore')}
                    value={
                      metrics.pre_assessment_score != null
                        ? `${metrics.pre_assessment_score}${
                            metrics.pre_assessment_level
                              ? ` · ${t(`knowledgeLevel.${metrics.pre_assessment_level}`)}`
                              : ''
                          }`
                        : null
                    }
                  />
                  <MetricTile
                    label={t('manageHub.studentCards.postScore')}
                    value={
                      metrics.post_assessment_score != null
                        ? `${metrics.post_assessment_score}`
                        : null
                    }
                  />
                  <MetricTile
                    label={t('manageHub.studentCards.postAssessmentStatus')}
                    value={
                      assessments.post?.attempt_status_label ||
                      metrics.post_assessment_attempt_status_label ||
                      null
                    }
                  />
                  <MetricTile
                    label={t('progress.eligibility')}
                    value={t(
                      `eligibility.${metrics.completion_eligibility_status || 'pending'}`,
                      metrics.completion_eligibility_status || 'pending'
                    )}
                  />
                  <MetricTile
                    label={t('progress.letterIssued')}
                    value={
                      metrics.completion_letter_issued_at || letter
                        ? t('commonYes')
                        : t('commonNo')
                    }
                  />
                </div>
              </section>

              <section className="ft-student-drawer__section">
                <h3>
                  <ClipboardList size={16} aria-hidden /> {t('manageHub.tabs.tasks')}
                </h3>
                {!taskRows.length ? (
                  <p className="ft-manage-panel__desc">{t('tasks.noTasks')}</p>
                ) : (
                  <ul className="ft-student-drawer__list">
                    {taskRows.map((task) => {
                      const presented = resolveTaskPresentation({
                        task: { id: task.task_id, title: task.task_title },
                        submission: task.submission_id
                          ? {
                              id: task.submission_id,
                              review_status: task.review_status,
                              manual_score: task.manual_score,
                              max_score: task.max_score,
                              submitted_at: task.submitted_at,
                              is_late: task.is_late,
                            }
                          : null,
                      });
                      return (
                      <li key={task.task_id}>
                        <div>
                          <strong>{task.task_title}</strong>
                          <p>
                            {t('tasks.submissionState')}: {presented.submissionLabelAr}
                            {' · '}
                            {t('tasks.evaluationState')}: {presented.evaluationLabelAr}
                            {presented.score != null
                              ? ` · ${t('scoreBreakdown.grade')}: ${formatScore(presented.score, presented.maxScore || 100)}`
                              : ` · ${t('scoreBreakdown.noGrade')}`}
                            {presented.timingLabelAr ? ` · ${presented.timingLabelAr}` : ''}
                            {presented.submittedAt
                              ? ` · ${formatFtDate(presented.submittedAt) || t('common.unavailable', 'غير متوفر')}`
                              : ''}
                          </p>
                          {task.instructor_feedback ? (
                            <p className="ft-student-drawer__note">
                              {t('tasks.instructorFeedback')}: {task.instructor_feedback}
                            </p>
                          ) : null}
                          {task.ai_summary ? (
                            <p className="ft-student-drawer__note">
                              {t('tasks.aiResponse')}: {task.ai_summary}
                            </p>
                          ) : null}
                        </div>
                        {task.submission_id ? (
                          <Button
                            as={Link}
                            to={`${listBase}/${opportunityId}/tasks#ft-submissions-title`}
                            variant="outline"
                            className="btn--sm"
                          >
                            {t('manageHub.studentCards.openTaskDetails')}
                          </Button>
                        ) : null}
                      </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="ft-student-drawer__section">
                <h3>
                  <Calendar size={16} aria-hidden /> {t('manageHub.tabs.attendance')}
                </h3>
                {!attendanceRecords.length ? (
                  <p className="ft-manage-panel__desc">{t('manageHub.noSessions')}</p>
                ) : (
                  <div className="ft-student-drawer__table-wrap">
                    <table className="ft-student-drawer__table">
                      <thead>
                        <tr>
                          <th>{t('manageTraining.sessionTitle')}</th>
                          <th>{t('manageTraining.sessionDate')}</th>
                          <th>{t('manageHub.studentCards.attendanceStatus')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceRecords.map((row) => (
                          <tr key={row.session_id}>
                            <td>{row.session_title}</td>
                            <td>{row.session_date || t('common.unavailable', 'غير متوفر')}</td>
                            <td>
                              {row.status
                                ? t(`attendanceStatus.${row.status}`)
                                : t('manageHub.studentCards.attendanceNotRecorded')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="ft-student-drawer__section">
                <h3>
                  <FileText size={16} aria-hidden /> {t('manageHub.studentCards.assessments')}
                </h3>
                <div className="ft-student-drawer__assess-grid">
                  <article>
                    <h4>{t('manageHub.tabs.pre_assessment')}</h4>
                    <p>
                      {t('manageHub.studentCards.score')}:{' '}
                      {assessments.pre?.score ?? metrics.pre_assessment_score ?? t('common.unavailable', 'غير متوفر')}
                    </p>
                    <p>
                      {t('manageHub.studentCards.attemptDate')}:{' '}
                      {assessments.pre?.submitted_at
                        ? formatFtDate(assessments.pre.submitted_at) ||
                          String(assessments.pre.submitted_at).slice(0, 16)
                        : t('common.unavailable', 'غير متوفر')}
                    </p>
                  </article>
                  <article>
                    <h4>{t('manageHub.tabs.post_assessment')}</h4>
                    <p>
                      {t('manageHub.studentCards.score')}:{' '}
                      {assessments.post?.score ?? metrics.post_assessment_score ?? t('common.unavailable', 'غير متوفر')}
                    </p>
                    <p>
                      {t('manageHub.studentCards.postAssessmentStatus')}:{' '}
                      {assessments.post?.attempt_status_label ||
                        metrics.post_assessment_attempt_status_label ||
                        'لم يبدأ'}
                    </p>
                    <p>
                      {t('manageHub.studentCards.attemptDate')}:{' '}
                      {assessments.post?.submitted_at
                        ? formatFtDate(assessments.post.submitted_at) ||
                          String(assessments.post.submitted_at).slice(0, 16)
                        : t('common.unavailable', 'غير متوفر')}
                    </p>
                  </article>
                </div>
              </section>

              <section className="ft-student-drawer__section">
                <h3>
                  <Award size={16} aria-hidden /> {t('manageHub.tabs.eligibility')}
                </h3>
                <p>
                  {t('manageHub.studentCards.eligibleQuestion')}:{' '}
                  <strong>
                    {t(
                      `eligibility.${app.completion_eligibility_status || 'pending'}`,
                      app.completion_eligibility_status || 'pending'
                    )}
                  </strong>
                </p>
                {app.eligibility_reason ? (
                  <p className="ft-student-drawer__note">
                    {typeof app.eligibility_reason === 'string'
                      ? app.eligibility_reason
                      : JSON.stringify(app.eligibility_reason?.reasons || app.eligibility_reason)}
                  </p>
                ) : null}
                {Array.isArray(letterGate?.reasons) && letterGate.reasons.length ? (
                  <ul className="ft-eligibility-reasons">
                    {letterGate.reasons.map((reason) => (
                      <li key={String(reason)}>{String(reason)}</li>
                    ))}
                  </ul>
                ) : null}
                <p>
                  {t('progress.letterIssued')}:{' '}
                  {letter || app.completion_letter_issued_at ? t('commonYes') : t('commonNo')}
                </p>
              </section>
            </>
          ) : null}

          {actionError ? <p className="form-field__error">{actionError}</p> : null}
          {actionOk ? <p className="auth-register__helper">{actionOk}</p> : null}
        </div>

        <footer className="ft-student-drawer__footer">
          {canApproveReject ? (
            <>
              <Button type="button" variant="primary" onClick={() => onApprove?.(app.id)}>
                <CheckCircle2 size={16} aria-hidden /> {t('approveApplication')}
              </Button>
              <Button type="button" variant="outline" onClick={() => onReject?.(app.id)}>
                <XCircle size={16} aria-hidden /> {t('rejectApplication')}
              </Button>
            </>
          ) : null}
          {canExpel ? (
            <Button type="button" variant="outline" onClick={() => onExpel?.(app)}>
              <UserX size={16} aria-hidden />
              {readOnly ? t('expel.requestAction') : t('expel.action')}
            </Button>
          ) : null}
          {canRecalc ? (
            <Button
              type="button"
              variant="outline"
              disabled={recalcMut.isPending}
              onClick={() => {
                setActionError('');
                setActionOk('');
                recalcMut.mutate();
              }}
            >
              <RefreshCw size={16} aria-hidden />
              {recalcMut.isPending ? t('saving') : t('manageHub.studentCards.recalculateEligibility')}
            </Button>
          ) : null}
          {app?.id && opportunityId ? (
            <Link
              className="btn btn--primary"
              to={
                isInstructor
                  ? `/instructor/field-training/${opportunityId}/students/${app.id}/report`
                  : `/admin/field-training/${opportunityId}/students/${app.id}/report`
              }
            >
              <FileText size={16} aria-hidden />
              {t('eligibilityCard.comprehensiveReport')}
            </Link>
          ) : null}
          {canIssueLetter ? (
            <Button
              type="button"
              variant="primary"
              disabled={issueMut.isPending}
              onClick={() => {
                setActionError('');
                setActionOk('');
                issueMut.mutate();
              }}
            >
              <Award size={16} aria-hidden />
              {issueMut.isPending ? t('saving') : t('completionLetter.issue')}
            </Button>
          ) : null}
          {canPreviewLetter ? (
            <Button
              type="button"
              variant="outline"
              disabled={previewMut.isPending}
              onClick={() => {
                setActionError('');
                previewMut.mutate();
              }}
            >
              <Eye size={16} aria-hidden />
              {t('completionLetter.preview')}
            </Button>
          ) : null}
          {canDownloadLetter ? (
            <Button
              type="button"
              variant="outline"
              disabled={downloadMut.isPending}
              onClick={() => {
                setActionError('');
                downloadMut.mutate();
              }}
            >
              <Download size={16} aria-hidden />
              {t('completionLetter.download')}
            </Button>
          ) : null}
          <Button
            as={Link}
            to={
              isInstructor
                ? `${listBase}/${opportunityId}/participants`
                : `${listBase}/${opportunityId}/applications`
            }
            variant="outline"
          >
            <ExternalLink size={16} aria-hidden />
            {t('manageHub.openFullPage')}
          </Button>
        </footer>
      </aside>
    </div>
  );
}
