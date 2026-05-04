import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ProgramDetailsTabs } from '../../components/student/enrollment/ProgramDetailsTabs.jsx';
import { PendingStateBanner } from '../../components/student/enrollment/PendingStateBanner.jsx';
import { useLocale } from '../../features/locale/index.js';
import { useCohort, useCohortAttendanceSummary } from '../../features/cohorts/index.js';
import { useSessions } from '../../features/sessions/hooks/useSessions.js';
import { useAssessments } from '../../features/assessments/index.js';
import { useGrades } from '../../features/grades/index.js';
import { useSubmissions } from '../../features/submissions/index.js';
import { useCertificates } from '../../features/certificates/hooks/useCertificates.js';
import { useStudentEnrollments } from '../../features/enrollments/index.js';
import { statusLabelAr } from '../../utils/statusMap.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

export function StudentProgramDetailPage() {
  const { id: cohortId } = useParams();
  const { t } = useTranslation('enrollments');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();

  const [tab, setTab] = useState('sessions');

  const { data: mine, isLoading: mineLoading } = useStudentEnrollments({ staleTime: 20_000 });
  const { data: cohort, isLoading: cLoading, isError: cError, error: cErr } = useCohort(cohortId, { enabled: Boolean(cohortId) });
  const { data: sessionsPayload, isLoading: sLoading } = useSessions(cohortId, { enabled: Boolean(cohortId) });
  const { data: attPayload, isLoading: attLoading } = useCohortAttendanceSummary(cohortId, { enabled: Boolean(cohortId) });
  const { data: assessPayload, isLoading: asLoading } = useAssessments(
    { cohort_id: cohortId, page: 1, page_size: 200 },
    { enabled: Boolean(cohortId) }
  );
  const { data: gradesPayload, isLoading: gLoading } = useGrades({}, { enabled: Boolean(cohortId) });
  const { data: subPayload, isLoading: subLoading } = useSubmissions({}, { enabled: Boolean(cohortId) });
  const { data: certPayload, isLoading: certLoading } = useCertificates(
    { cohort_id: cohortId, page: 1, page_size: 50 },
    { enabled: Boolean(cohortId) }
  );

  const enrollment = useMemo(() => {
    const list = mine?.enrollments ?? [];
    return list.find((e) => String(e.cohort_id) === String(cohortId));
  }, [mine, cohortId]);

  const isLimitedEnrollment =
    enrollment && ['pending', 'rejected', 'cancelled'].includes(enrollment.enrollment_status);

  const sessions = sessionsPayload?.sessions ?? [];
  const upcomingSessions = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return [...sessions].filter((s) => s.session_date >= today).sort((a, b) => a.session_date.localeCompare(b.session_date));
  }, [sessions]);
  const pastSessions = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return [...sessions].filter((s) => s.session_date < today).sort((a, b) => b.session_date.localeCompare(a.session_date));
  }, [sessions]);

  const assessments = assessPayload?.assessments ?? [];
  const assessmentIds = useMemo(() => new Set(assessments.map((a) => a.id)), [assessments]);

  const gradesInCohort = useMemo(() => {
    const grades = gradesPayload?.grades ?? [];
    return grades.filter((g) => g.assessment && assessmentIds.has(g.assessment_id));
  }, [gradesPayload, assessmentIds]);

  const submissionsInCohort = useMemo(() => {
    const subs = subPayload?.submissions ?? [];
    return subs.filter((s) => s.assessment && assessmentIds.has(s.assessment_id));
  }, [subPayload, assessmentIds]);

  const submissionByAssessment = useMemo(() => {
    const m = new Map();
    for (const s of submissionsInCohort) {
      if (!m.has(s.assessment_id)) m.set(s.assessment_id, s);
    }
    return m;
  }, [submissionsInCohort]);

  const certList = certPayload?.certificates ?? [];
  const primaryCert = certList[0];

  const attendanceRow = useMemo(() => {
    const rows = attPayload?.students ?? [];
    return rows[0];
  }, [attPayload]);

  const tabs = useMemo(
    () => [
      { id: 'sessions', label: t('studentEnrollment.detail.tabs.sessions') },
      { id: 'attendance', label: t('studentEnrollment.detail.tabs.attendance') },
      { id: 'assessments', label: t('studentEnrollment.detail.tabs.assessments') },
      { id: 'submissions', label: t('studentEnrollment.detail.tabs.submissions') },
      { id: 'grades', label: t('studentEnrollment.detail.tabs.grades') },
      { id: 'certificate', label: t('studentEnrollment.detail.tabs.certificate') },
    ],
    [t]
  );

  const loadErr = cError ? getApiErrorMessage(cErr) : '';

  if (!cohortId) {
    return <Navigate to="/student/programs" replace />;
  }

  if (mineLoading) {
    return <LoadingSpinner />;
  }

  if (!enrollment) {
    return <Navigate to="/student/available-cohorts" replace />;
  }

  if (isLimitedEnrollment) {
    const cohortBrief = enrollment.cohort;
    return (
      <div className="page page--dashboard page--student">
        <AdminPageHeader
          title={cohortBrief?.title ?? cohort?.title ?? '—'}
          description={cohortBrief?.micro_credential?.title ?? cohort?.micro_credential?.title ?? ''}
        />
        <PendingStateBanner variant="warning">
          {enrollment.enrollment_status === 'pending'
            ? t('studentEnrollment.waitingApprovalDetail')
            : t('studentEnrollment.rejectedDetail')}
        </PendingStateBanner>
        <p className="crud-muted" style={{ marginTop: 16 }}>
          <Link to="/student/available-cohorts">{t('studentEnrollment.backToCatalog')}</Link>
        </p>
      </div>
    );
  }

  if (cLoading) {
    return <LoadingSpinner />;
  }

  if (loadErr || !cohort) {
    return (
      <div className="page page--dashboard page--student">
        <p className="form-error">{loadErr || tCommon('errors.notFound')}</p>
        <Link to="/student/programs">{t('studentEnrollment.backToPrograms')}</Link>
      </div>
    );
  }

  const uniName = cohort.university?.name ?? '—';
  const mcTitle = cohort.micro_credential?.title ?? '—';

  return (
    <div className="page page--dashboard page--student">
      <AdminPageHeader
        title={mcTitle}
        description={
          <>
            {cohort.title} · {uniName} ·{' '}
            <span className="crud-muted">{statusLabelAr(enrollment.enrollment_status, locale)}</span>
          </>
        }
      />

      <ProgramDetailsTabs value={tab} onChange={setTab} tabs={tabs}>
        {tab === 'sessions' ? (
          <div className="student-program-detail-split">
            <section>
              <h4 className="student-program-detail-h4">{t('studentEnrollment.detail.upcomingSessions')}</h4>
              {sLoading ? (
                <p className="crud-muted">{tCommon('loading')}</p>
              ) : (
                <DataTable
                  emptyTitle={t('studentEnrollment.detail.noSessions')}
                  columns={[
                    { key: 'title', label: t('studentEnrollment.detail.sessionTitle') },
                    { key: 'session_date', label: t('studentEnrollment.detail.sessionDate') },
                    { key: 'start_time', label: t('studentEnrollment.detail.time') },
                  ]}
                  rows={upcomingSessions}
                />
              )}
            </section>
            <section>
              <h4 className="student-program-detail-h4">{t('studentEnrollment.detail.pastSessions')}</h4>
              {sLoading ? null : (
                <DataTable
                  emptyTitle={t('studentEnrollment.detail.noPastSessions')}
                  columns={[
                    { key: 'title', label: t('studentEnrollment.detail.sessionTitle') },
                    { key: 'session_date', label: t('studentEnrollment.detail.sessionDate') },
                  ]}
                  rows={pastSessions}
                />
              )}
            </section>
          </div>
        ) : null}

        {tab === 'attendance' ? (
          <div>
            {attLoading ? (
              <p className="crud-muted">{tCommon('loading')}</p>
            ) : (
              <>
                <p className="student-program-detail-stat">
                  {t('studentEnrollment.detail.attendancePct')}:{' '}
                  <strong>
                    {enrollment.attendance_percentage != null ? `${enrollment.attendance_percentage}%` : attendanceRow?.attendance_percentage ?? '—'}
                  </strong>
                </p>
                <DataTable
                  emptyTitle={t('studentEnrollment.detail.noAttendance')}
                  columns={[
                    { key: 'total_sessions', label: t('studentEnrollment.detail.totalSessions') },
                    { key: 'total_present', label: t('studentEnrollment.detail.present') },
                    { key: 'total_absent', label: t('studentEnrollment.detail.absent') },
                    { key: 'total_late', label: t('studentEnrollment.detail.late') },
                  ]}
                  rows={attendanceRow ? [attendanceRow] : []}
                />
              </>
            )}
          </div>
        ) : null}

        {tab === 'assessments' ? (
          <div>
            {asLoading ? (
              <p className="crud-muted">{tCommon('loading')}</p>
            ) : (
              <DataTable
                emptyTitle={t('studentEnrollment.detail.noAssessments')}
                columns={[
                  { key: 'title', label: t('studentEnrollment.detail.assessmentTitle') },
                  { key: 'due_date', label: t('studentEnrollment.detail.due') },
                  {
                    key: 'st',
                    label: t('studentEnrollment.detail.status'),
                    render: (a) => {
                      const graded = gradesInCohort.some((g) => g.assessment_id === a.id);
                      const submitted = submissionByAssessment.has(a.id);
                      if (graded) return t('studentEnrollment.detail.assessGraded');
                      if (submitted) return t('studentEnrollment.detail.assessSubmitted');
                      if (a.status === 'open') return t('studentEnrollment.detail.assessOpen');
                      if (a.status === 'closed') return t('studentEnrollment.detail.assessClosed');
                      return statusLabelAr(a.status, locale);
                    },
                  },
                ]}
                rows={assessments}
              />
            )}
          </div>
        ) : null}

        {tab === 'submissions' ? (
          <div>
            {subLoading ? (
              <p className="crud-muted">{tCommon('loading')}</p>
            ) : (
              <DataTable
                emptyTitle={t('studentEnrollment.detail.noSubmissions')}
                columns={[
                  {
                    key: 'assessment',
                    label: t('studentEnrollment.detail.assessmentTitle'),
                    render: (r) => r.assessment?.title ?? '—',
                  },
                  { key: 'submitted_at', label: t('studentEnrollment.detail.submittedAt') },
                  { key: 'status', label: t('studentEnrollment.detail.status'), render: (r) => statusLabelAr(r.status, locale) },
                ]}
                rows={submissionsInCohort}
              />
            )}
          </div>
        ) : null}

        {tab === 'grades' ? (
          <div>
            {gLoading ? (
              <p className="crud-muted">{tCommon('loading')}</p>
            ) : (
              <DataTable
                emptyTitle={t('studentEnrollment.detail.noGrades')}
                columns={[
                  {
                    key: 'assessment',
                    label: t('studentEnrollment.detail.assessmentTitle'),
                    render: (r) => r.assessment?.title ?? '—',
                  },
                  { key: 'score', label: t('studentEnrollment.detail.score'), render: (r) => (r.score != null ? String(r.score) : '—') },
                  { key: 'feedback', label: t('studentEnrollment.detail.feedback') },
                ]}
                rows={gradesInCohort}
              />
            )}
          </div>
        ) : null}

        {tab === 'certificate' ? (
          <div>
            {certLoading ? (
              <p className="crud-muted">{tCommon('loading')}</p>
            ) : primaryCert ? (
              <dl className="crud-dl">
                <div>
                  <dt>{t('studentEnrollment.detail.certStatus')}</dt>
                  <dd>{statusLabelAr(primaryCert.status, locale)}</dd>
                </div>
                {primaryCert.verification_code ? (
                  <div>
                    <dt>{t('studentEnrollment.detail.verifyCode')}</dt>
                    <dd>{primaryCert.verification_code}</dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className="crud-muted">{t('studentEnrollment.detail.noCertificate')}</p>
            )}
          </div>
        ) : null}
      </ProgramDetailsTabs>
    </div>
  );
}
