import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Download, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { useComprehensiveStudentReport } from '../../../features/fieldTraining/hooks/useAdminFieldTraining.js';
import { downloadComprehensiveStudentReportPdf } from '../../../features/fieldTraining/fieldTraining.service.js';

const ACTIVITY_FILTERS = [
  { key: '', labelKey: 'comprehensiveReport.filters.all' },
  { key: 'ACCOUNT', labelKey: 'comprehensiveReport.filters.account' },
  { key: 'ATTENDANCE', labelKey: 'comprehensiveReport.filters.attendance' },
  { key: 'TASKS', labelKey: 'comprehensiveReport.filters.tasks' },
  { key: 'ASSESSMENTS', labelKey: 'comprehensiveReport.filters.assessments' },
  { key: 'ELIGIBILITY', labelKey: 'comprehensiveReport.filters.eligibility' },
];

function eligibilityVariant(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'eligible' || s === 'eligibile') return 'success';
  if (s === 'ineligible' || s === 'not_eligible') return 'danger';
  if (s === 'needs_review' || s === 'incomplete') return 'warning';
  return 'muted';
}

function displayValue(value) {
  if (value == null || value === '' || value === '—' || value === '–') return 'غير متوفر';
  return value;
}

function DetailGrid({ items }) {
  return (
    <dl className="ft-comp-report__grid">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{displayValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function FieldTrainingComprehensiveStudentReportPage({
  apiScope = 'admin',
  manageBasePath,
}) {
  const { id: opportunityId, applicationId } = useParams();
  const { t } = useTranslation('fieldTraining');
  const [activityCategory, setActivityCategory] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const isInstructor = apiScope === 'instructor';
  const backHref =
    manageBasePath ||
    (isInstructor
      ? `/instructor/field-training/${opportunityId}/manage?tab=eligibility`
      : `/admin/field-training/${opportunityId}/manage?tab=eligibility`);

  const { data, isLoading, isError, error } = useComprehensiveStudentReport(
    opportunityId,
    applicationId,
    {
      scope: apiScope,
      params: activityCategory ? { activity_category: activityCategory } : {},
    }
  );

  async function handleDownloadPdf() {
    if (downloadingPdf) return;
    setDownloadingPdf(true);
    setDownloadError('');
    try {
      await downloadComprehensiveStudentReportPdf(opportunityId, applicationId, {
        asInstructor: isInstructor,
        params: activityCategory ? { activity_category: activityCategory } : {},
      });
    } catch (err) {
      setDownloadError(getApiErrorMessage(err) || t('comprehensiveReport.downloadFailed'));
    } finally {
      setDownloadingPdf(false);
    }
  }

  const status =
    data?.eligibility?.workflowOutcome ||
    data?.application?.eligibilityStatus ||
    'pending';

  const headerItems = useMemo(() => {
    if (!data) return [];
    return [
      [t('eligibilityCard.universityNumber'), data.student?.universityNumber],
      [t('manageHub.studentCards.university'), data.student?.university],
      [t('manageHub.studentCards.specialty'), data.student?.specialty],
      [t('comprehensiveReport.opportunity'), data.opportunity?.title],
      [t('comprehensiveReport.organization'), data.opportunity?.organizationName],
      [
        t('comprehensiveReport.trainingDates'),
        [data.opportunity?.startDateLabelAr, data.opportunity?.endDateLabelAr]
          .filter(Boolean)
          .join(' — ') || '—',
      ],
      [t('table.trainingStatus'), t(`trainingStatus.${data.application?.trainingStatus}`, data.application?.trainingStatus)],
    ];
  }, [data, t]);

  if (isLoading) {
    return (
      <div className="page page--admin">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page page--admin">
        <p role="alert">{getApiErrorMessage(error)}</p>
        <Link to={backHref}>{t('comprehensiveReport.back')}</Link>
      </div>
    );
  }

  const q = data.eligibility || {};
  const scoring = data.scoring || {};
  const components = scoring.components || {};

  return (
    <div className="page page--admin ft-comp-report">
      <AdminPageHeader
        title={t('comprehensiveReport.title')}
        description={data.student?.fullName || ''}
        actions={
          <div className="ft-comp-report__toolbar">
            <Link className="btn btn--outline btn--sm" to={backHref}>
              <ArrowRight size={14} />
              {t('comprehensiveReport.back')}
            </Link>
            <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
              <Printer size={14} />
              {t('comprehensiveReport.print')}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
            >
              <Download size={14} />
              {downloadingPdf
                ? t('comprehensiveReport.downloadingPdf')
                : t('comprehensiveReport.downloadPdf')}
            </Button>
          </div>
        }
      />
      {downloadError ? (
        <p className="ft-comp-report__error" role="alert">
          {downloadError}
        </p>
      ) : null}

      <SectionCard title={t('comprehensiveReport.studentHeader')}>
        <div className="ft-comp-report__identity">
          <div>
            <h2>{data.student?.fullName}</h2>
            <StatusBadge variant={eligibilityVariant(status)}>
              {t(`eligibility.${status}`, status)}
            </StatusBadge>
          </div>
          <DetailGrid items={headerItems} />
        </div>
      </SectionCard>

      <SectionCard title={t('comprehensiveReport.qualification')}>
        <div className="ft-comp-report__score-hero">
          <div>
            <span>
              {q.approvedEvaluationResult
                ? t('eligibilityCard.approvedScore')
                : t('scoreBreakdown.finalScore')}
            </span>
            <strong>
              {q.finalScore != null ? `${q.finalScore} / 100` : '— / 100'}
            </strong>
          </div>
          <div>
            <span>{t('scoreBreakdown.passingScore', { score: q.passingScore ?? 80 })}</span>
            <p className={q.scoreDifference >= 0 ? 'is-pass' : 'is-fail'}>
              {q.scoreDifferenceLabelAr || '—'}
            </p>
          </div>
        </div>
        {q.approvedEvaluationResult?.changeReasonAr &&
        !/AUTHORIZED|قرار إداري معتمد بعدم التأهيل مع الاحتفاظ/.test(
          q.approvedEvaluationResult.changeReasonAr
        ) ? (
          <DetailGrid
            items={[
              [
                t('comprehensiveReport.attendanceDifferenceReason'),
                q.approvedEvaluationResult.changeReasonAr,
              ],
            ]}
          />
        ) : null}
        {q.zeroParticipationApplied ? (
          <DetailGrid
            items={[
              [
                t('comprehensiveReport.recordedAttendance'),
                q.recordedAttendancePercent != null
                  ? `${q.recordedAttendancePercent}%`
                  : components.attendance?.recordedAttendancePercentage != null
                    ? `${components.attendance.recordedAttendancePercentage}%`
                    : '—',
              ],
              [
                t('comprehensiveReport.evaluationAttendance'),
                components.attendance?.evaluationAttendancePercentage != null
                  ? `${components.attendance.evaluationAttendancePercentage}%`
                  : '0%',
              ],
              [
                t('comprehensiveReport.attendanceDifferenceReason'),
                t('comprehensiveReport.zeroParticipationReason'),
              ],
            ]}
          />
        ) : null}
        {q.eligibilityOverride ? (
          <p className="ft-comp-report__override">
            {t('comprehensiveReport.adminOverride')}: {q.eligibilityOverride.reasonAr}
          </p>
        ) : null}
        <dl className="ft-comp-report__gate-grid">
          {(q.mandatoryGates || []).map((gate) => (
            <div key={gate.key}>
              <dt>{gate.nameAr}</dt>
              <dd>
                <StatusBadge
                  variant={
                    gate.status === 'passed' || gate.status === 'complete'
                      ? 'success'
                      : gate.status === 'failed' || gate.status === 'incomplete'
                        ? 'danger'
                        : 'muted'
                  }
                >
                  {gate.labelAr}
                </StatusBadge>
              </dd>
            </div>
          ))}
        </dl>
      </SectionCard>

      <SectionCard title={t('comprehensiveReport.scoreBreakdown')}>
        {q.approvedEvaluationResult ? (
          <p className="ft-comp-report__note">{t('eligibilityCard.approvedAfterReview')}</p>
        ) : null}
        <DetailGrid
          items={[
            [
              t('eligibilityCard.attendancePoints'),
              q.scoreBreakdown?.attendancePoints != null
                ? `${q.scoreBreakdown.attendancePoints} / 20`
                : components.attendance
                  ? `${components.attendance.points ?? '—'} / 20`
                  : '—',
            ],
            [
              t('eligibilityCard.postPoints'),
              q.scoreBreakdown?.postAssessmentPoints != null
                ? `${q.scoreBreakdown.postAssessmentPoints} / 20`
                : components.postAssessment
                  ? `${components.postAssessment.points ?? '—'} / 20`
                  : '—',
            ],
            [
              t('eligibilityCard.tasksPoints'),
              q.scoreBreakdown?.taskPoints != null
                ? `${q.scoreBreakdown.taskPoints} / 40`
                : components.tasks
                  ? `${components.tasks.points ?? '—'} / 40`
                  : '—',
            ],
            [
              t('eligibilityCard.behaviorPoints'),
              q.scoreBreakdown?.behaviorPoints != null
                ? `${q.scoreBreakdown.behaviorPoints} / 20`
                : components.behavior
                  ? `${components.behavior.points ?? '—'} / 20`
                  : '—',
            ],
            [
              t('eligibilityCard.approvedScore'),
              q.finalScore != null ? `${q.finalScore} / 100` : '—',
            ],
          ]}
        />
      </SectionCard>

      <SectionCard title={t('comprehensiveReport.attendance')}>
        <DetailGrid
          items={[
            [t('comprehensiveReport.requiredSessions'), data.attendance?.requiredSessions],
            [t('comprehensiveReport.attended'), data.attendance?.attended],
            [t('comprehensiveReport.present'), data.attendance?.counts?.present],
            [t('comprehensiveReport.late'), data.attendance?.counts?.late],
            [t('comprehensiveReport.excused'), data.attendance?.counts?.excused],
            [t('comprehensiveReport.absent'), data.attendance?.counts?.absent],
            [t('progress.attendance'), data.attendance?.percentage != null ? `${data.attendance.percentage}%` : '—'],
            [
              t('hours.title'),
              data.attendance?.completedHours != null && data.attendance?.requiredHours != null
                ? `${data.attendance.completedHours} / ${data.attendance.requiredHours}`
                : '—',
            ],
          ]}
        />
        <div className="ft-comp-report__table-wrap">
          <table className="ft-comp-report__table">
            <thead>
              <tr>
                <th>{t('comprehensiveReport.date')}</th>
                <th>{t('comprehensiveReport.session')}</th>
                <th>{t('comprehensiveReport.status')}</th>
                <th>{t('comprehensiveReport.duration')}</th>
              </tr>
            </thead>
            <tbody>
              {(data.attendance?.sessions || []).map((session) => (
                <tr key={session.sessionId}>
                  <td>{session.dateLabelAr || '—'}</td>
                  <td>{session.title}</td>
                  <td>{session.statusLabelAr}</td>
                  <td>{session.durationHours != null ? `${session.durationHours}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title={t('comprehensiveReport.tasks')}>
        <p>
          {t('eligibilityCard.tasksCompleted', {
            done: data.tasks?.completedCount ?? 0,
            total: data.tasks?.requiredCount ?? 0,
          })}
        </p>
        <div className="ft-comp-report__table-wrap">
          <table className="ft-comp-report__table">
            <thead>
              <tr>
                <th>{t('comprehensiveReport.taskName')}</th>
                <th>{t('comprehensiveReport.submissionStatus')}</th>
                <th>{t('comprehensiveReport.reviewStatus')}</th>
                <th>{t('comprehensiveReport.grade')}</th>
                <th>{t('comprehensiveReport.submittedAt')}</th>
              </tr>
            </thead>
            <tbody>
              {(data.tasks?.items || []).map((task) => (
                <tr key={task.taskId}>
                  <td>{task.title}</td>
                  <td>
                    {task.submissionStatus === 'NOT_SUBMITTED' ||
                    task.submissionStatus === 'missing' ||
                    !task.submissionStatus ||
                    task.submissionStatus === 'not_submitted'
                      ? t('tasks.reviewStatuses.not_submitted', 'غير مسلّم')
                      : t('comprehensiveReport.submitted', 'مسلّم')}
                  </td>
                  <td>
                    {task.accepted ||
                    task.submissionStatus === 'SUBMITTED' ||
                    task.reviewStatus === 'graded' ||
                    task.reviewStatus === 'approved'
                      ? t('eligibilityCard.completed')
                      : t('tasks.reviewStatuses.not_submitted', 'غير مسلّم')}
                  </td>
                  <td>
                    {task.approvedTaskScore != null
                      ? `${task.approvedTaskScore}/100`
                      : task.score != null
                        ? `${task.score}${task.maxScore != null ? `/${task.maxScore}` : '/100'}`
                        : '—'}
                  </td>
                  <td>{task.submittedAtLabelAr || 'لا يوجد'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title={t('comprehensiveReport.assessments')}>
        <DetailGrid
          items={[
            [
              t('eligibilityCard.preAssessment'),
              data.assessments?.pre?.completed
                ? `${data.assessments.pre.score ?? '—'} · ${data.assessments.pre.submittedAtLabelAr || ''}`
                : t('eligibilityCard.incomplete'),
            ],
            [
              t('eligibilityCard.postAssessment'),
              data.assessments?.post?.completed
                ? `${data.assessments.post.score ?? '—'} · ${data.assessments.post.submittedAtLabelAr || ''}`
                : t('eligibilityCard.incomplete'),
            ],
          ]}
        />
      </SectionCard>

      <SectionCard title={t('comprehensiveReport.behavior')}>
        <DetailGrid
          items={[
            [
              t('scoreBreakdown.professionalTotal'),
              data.professionalEvaluation?.professionalTotal != null
                ? `${data.professionalEvaluation.professionalTotal} / 50`
                : '—',
            ],
            [
              t('scoreBreakdown.behaviorContribution'),
              data.professionalEvaluation?.behaviorPoints != null
                ? `${data.professionalEvaluation.behaviorPoints} / 20`
                : '—',
            ],
          ]}
        />
        <ul className="ft-comp-report__criteria">
          {(data.professionalEvaluation?.criteria || []).map((c) => (
            <li key={c.key}>
              <span>{c.labelAr}</span>
              <strong>{c.score != null ? `${c.score} / ${c.maxScore}` : '—'}</strong>
            </li>
          ))}
        </ul>
      </SectionCard>

      {(q.eligibilityReasonLabels || []).length ? (
        <SectionCard title={t('scoreBreakdown.mandatoryReasons')}>
          <ul className="ft-comp-report__reasons">
            {(q.eligibilityReasonLabels || []).map((reason) => (
              <li key={reason}>❌ {reason}</li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <SectionCard title={t('comprehensiveReport.activity')}>
        <DetailGrid
          items={[
            [t('comprehensiveReport.loginCount'), data.activitySummary?.loginCountLabelAr],
            [t('comprehensiveReport.lastLogin'), data.activitySummary?.lastLoginAtLabelAr || '—'],
            [t('comprehensiveReport.firstActivity'), data.activitySummary?.firstActivityAtLabelAr || '—'],
            [
              t('comprehensiveReport.tasksSubmitted'),
              `${data.activitySummary?.taskSubmissionsCount ?? 0} / ${data.activitySummary?.requiredTasksCount ?? 0}`,
            ],
            [
              t('comprehensiveReport.attendanceEvents'),
              `${data.activitySummary?.attendanceEventsCount ?? 0} / ${data.activitySummary?.requiredSessionsCount ?? 0}`,
            ],
            [
              t('comprehensiveReport.assessmentsCompleted'),
              `${data.activitySummary?.assessmentsCompletedCount ?? 0} / ${data.activitySummary?.assessmentsRequiredCount ?? 0}`,
            ],
          ]}
        />
        <div className="ft-comp-report__filters">
          {ACTIVITY_FILTERS.map((f) => (
            <button
              key={f.key || 'all'}
              type="button"
              className={`btn btn--sm ${activityCategory === f.key ? 'btn--primary' : 'btn--outline'}`}
              onClick={() => setActivityCategory(f.key)}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>
        <ol className="ft-comp-report__timeline">
          {(data.activityTimeline || []).map((item) => (
            <li key={item.id}>
              <time>{item.atLabelAr}</time>
              <div>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
                <span>{item.categoryLabelAr}</span>
              </div>
            </li>
          ))}
          {!data.activityTimeline?.length ? (
            <li className="ft-comp-report__empty">{t('comprehensiveReport.noActivity')}</li>
          ) : null}
        </ol>
      </SectionCard>

      <footer className="ft-comp-report__meta">
        <p>
          {t('comprehensiveReport.generatedAt')}: {data.generatedAtLabelAr}
        </p>
        <p>
          {t('comprehensiveReport.opportunity')}: {data.opportunity?.title}
        </p>
        <p>
          {t('comprehensiveReport.statusAtGeneration')}:{' '}
          {t(`eligibility.${status}`, status)}
        </p>
      </footer>
    </div>
  );
}
