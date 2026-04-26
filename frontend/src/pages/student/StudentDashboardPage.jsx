import { useMemo } from 'react';
import {
  BookOpen,
  Calendar,
  ClipboardList,
  Award,
  Percent,
  BarChart3,
  Bell,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { useAuth } from '../../features/auth/index.js';
import { useStudentEnrollments } from '../../features/enrollments/index.js';
import { useStudentSessions } from '../../features/sessions/index.js';
import { useAssessments } from '../../features/assessments/index.js';
import { useSubmissions } from '../../features/submissions/index.js';
import { useStudentGrades } from '../../features/grades/index.js';
import { useCertificates } from '../../features/certificates/index.js';
import { useNotifications } from '../../features/notifications/hooks/useNotifications.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';
import {
  filterUpcomingSessions,
  isOpenAssessment,
  latestSubmissionForAssessment,
  submissionNeedsWork,
  averageEnrollmentAttendancePct,
  averageFinalGradePercent,
  sortGradesRecentFirst,
} from '../../features/student/studentDashboard.helpers.js';
import {
  StudentKpiCard,
  StudentNextActionCard,
  StudentProgramCard,
  StudentDashboardSkeleton,
  StudentAttendanceWidget,
  StudentGradeList,
  StudentCertificateEligibility,
} from '../../components/student/index.js';

function formatDue(d, lng) {
  if (d == null) return null;
  const t = new Date(d).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(d).toLocaleDateString(lng, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function StudentDashboardPage() {
  const { t } = useTranslation('dashboard');
  const { t: tCommon } = useTranslation('common');
  const { i18n } = useTranslation();
  const { user } = useAuth();

  const enrollmentsQuery = useStudentEnrollments({ staleTime: 30_000 });
  const sessionsQuery = useStudentSessions({ staleTime: 30_000 });
  const assessmentsQuery = useAssessments({ page: 1, page_size: 100 }, { staleTime: 30_000 });
  const submissionsQuery = useSubmissions({ page: 1, page_size: 200 }, { staleTime: 30_000 });
  const gradesQuery = useStudentGrades({ page: 1, page_size: 200 }, { staleTime: 30_000 });
  const certificatesQuery = useCertificates({ page: 1, page_size: 50 }, { staleTime: 60_000 });
  const notificationsQuery = useNotifications({ page: 1, page_size: 8 }, { staleTime: 20_000 });

  const enrollments = enrollmentsQuery.data?.enrollments ?? [];
  const sessions = sessionsQuery.data?.sessions ?? [];
  const assessments = assessmentsQuery.data?.assessments ?? [];
  const submissions = submissionsQuery.data?.submissions ?? [];
  const grades = gradesQuery.data?.grades ?? [];
  const certificates = certificatesQuery.data?.certificates ?? [];
  const notifications = notificationsQuery.data?.notifications ?? [];

  const activeEnrollments = useMemo(
    () => enrollments.filter((e) => ['pending', 'enrolled', 'completed'].includes(String(e.enrollment_status || ''))),
    [enrollments]
  );

  const upcomingSessions = useMemo(() => filterUpcomingSessions(sessions).slice(0, 8), [sessions]);

  const openAssessments = useMemo(() => assessments.filter((a) => isOpenAssessment(a)), [assessments]);

  const pendingSubmissionCount = useMemo(() => {
    let n = 0;
    for (const a of openAssessments) {
      const sub = latestSubmissionForAssessment(submissions, a.id);
      if (submissionNeedsWork(sub)) n += 1;
    }
    return n;
  }, [openAssessments, submissions]);

  const avgAttendance = useMemo(() => averageEnrollmentAttendancePct(activeEnrollments), [activeEnrollments]);
  const avgFinal = useMemo(() => averageFinalGradePercent(grades), [grades]);

  const latestGrades = useMemo(() => sortGradesRecentFirst(grades).slice(0, 6), [grades]);

  const unreadNotifications = useMemo(() => notifications.filter((x) => !x.is_read).length, [notifications]);

  const hasIssuedCertificate = useMemo(
    () => certificates.some((c) => String(c.status || '').toLowerCase() === 'issued'),
    [certificates]
  );

  const primaryRecognition = useMemo(() => {
    const e = activeEnrollments[0];
    return e?.recognition_eligibility_status ?? null;
  }, [activeEnrollments]);

  const nextActions = useMemo(() => {
    const items = [];
    const lang = i18n.language || 'ar';

    for (const a of [...openAssessments].sort((x, y) => new Date(x.due_date) - new Date(y.due_date))) {
      const sub = latestSubmissionForAssessment(submissions, a.id);
      if (!submissionNeedsWork(sub)) continue;
      const ctx = a.micro_credential?.title ?? a.cohort?.title ?? '';
      const due = formatDue(a.due_date, lang);
      items.push({
        key: `sub-${a.id}`,
        type: 'submit',
        title: t('student.dashboard.next.submitTitle', { title: a.title }),
        description: t('student.dashboard.next.submitDesc', { context: ctx || '—' }),
        dueDate: due,
        badge: due ? t('student.dashboard.badges.due') : t('student.dashboard.badges.pending'),
        badgeVariant: 'due',
        actionLabel: t('student.dashboard.actions.submit'),
        actionTo: '/student/assessments',
      });
      if (items.length >= 3) break;
    }

    const nextS = upcomingSessions[0];
    if (nextS && items.length < 4) {
      const ctx = nextS.cohort?.title ?? nextS.cohort?.micro_credential?.title ?? '';
      const when = nextS.session_date
        ? `${formatDue(nextS.session_date, lang) ?? ''} ${nextS.start_time ?? ''}`.trim()
        : null;
      items.push({
        key: `ses-${nextS.id}`,
        type: 'session',
        title: t('student.dashboard.next.sessionTitle', { title: nextS.title }),
        description: t('student.dashboard.next.sessionDesc', { context: ctx || '—' }),
        dueDate: when,
        badge: null,
        badgeVariant: 'default',
        actionLabel: t('student.dashboard.actions.viewSessions'),
        actionTo: '/student/sessions',
      });
    }

    if (avgAttendance != null && avgAttendance < 75 && items.length < 5) {
      items.push({
        key: 'att-low',
        type: 'alert',
        title: t('student.dashboard.next.attendanceTitle'),
        description: t('student.dashboard.next.attendanceDesc'),
        dueDate: null,
        badge: t('student.dashboard.badges.pending'),
        badgeVariant: 'default',
        actionLabel: t('student.dashboard.actions.viewAttendance'),
        actionTo: '/student/attendance',
      });
    }

    if (items.length < 5 && (pendingSubmissionCount > 0 || !hasIssuedCertificate)) {
      items.push({
        key: 'cert',
        type: 'cert',
        title: t('student.dashboard.next.certificateTitle'),
        description: t('student.dashboard.next.certificateDesc'),
        dueDate: null,
        badge: null,
        badgeVariant: 'default',
        actionLabel: t('student.dashboard.actions.viewCertificate'),
        actionTo: '/student/certificate',
      });
    }

    return items.slice(0, 5);
  }, [
    openAssessments,
    submissions,
    upcomingSessions,
    t,
    i18n.language,
    avgAttendance,
    pendingSubmissionCount,
    hasIssuedCertificate,
  ]);

  const initialShellLoading =
    enrollmentsQuery.isLoading &&
    !enrollmentsQuery.data &&
    !enrollmentsQuery.isError;

  if (initialShellLoading) {
    return (
      <div className="page page--dashboard page--student">
        <AdminPageHeader title={t('student.title')} description={t('student.description')} />
        <StudentDashboardSkeleton />
      </div>
    );
  }

  const displayName = user?.full_name || user?.name || user?.email || '—';
  const uniName = user?.university?.name || user?.primary_university?.name || null;
  const todayStr = new Date().toLocaleDateString(i18n.language || 'ar', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="page page--dashboard page--student student-dash">
      <AdminPageHeader title={t('student.title')} description={t('student.description')} />

      <section className="section-card">
        <div className="section-card__head">
          <h2 className="section-card__title">{t('student.dashboard.summary.welcome', { name: displayName })}</h2>
        </div>
        <div className="section-card__body">
          <p className="crud-muted" style={{ margin: '0 0 0.35rem' }}>
            {uniName ? t('student.dashboard.summary.university', { name: uniName }) : t('student.dashboard.summary.noUniversity')}
          </p>
          <p className="crud-muted" style={{ margin: 0 }}>
            {t('student.dashboard.summary.today', { date: todayStr })}
          </p>
        </div>
      </section>

      <div className="student-dash__kpis">
        <StudentKpiCard label={t('student.dashboard.kpi.enrolled')} value={String(activeEnrollments.length)} icon={BookOpen} color="primary" />
        <StudentKpiCard label={t('student.dashboard.kpi.sessions')} value={String(upcomingSessions.length)} icon={Calendar} color="info" />
        <StudentKpiCard label={t('student.dashboard.kpi.assessments')} value={String(openAssessments.length)} icon={ClipboardList} color="warning" />
        <StudentKpiCard label={t('student.dashboard.kpi.pending')} value={String(pendingSubmissionCount)} icon={Award} color="danger" />
        <StudentKpiCard
          label={t('student.dashboard.kpi.attendance')}
          value={avgAttendance == null ? '—' : `${Math.round(avgAttendance)}%`}
          icon={Percent}
          color="success"
        />
        <StudentKpiCard
          label={t('student.dashboard.kpi.grades')}
          value={avgFinal == null ? '—' : String(avgFinal)}
          icon={BarChart3}
          color="muted"
        />
      </div>

      <div className="student-dash__grid-2">
        <SectionCard title={t('student.dashboard.sections.nextActions')}>
          {enrollmentsQuery.isError ? (
            <p className="text-danger">{getApiErrorMessage(enrollmentsQuery.error, tCommon('errors.generic'))}</p>
          ) : null}
          {!enrollmentsQuery.isError && !activeEnrollments.length ? (
            <p className="crud-muted">{t('student.dashboard.empty.enrollments')}</p>
          ) : null}
          {!enrollmentsQuery.isError && activeEnrollments.length ? (
            <div className="student-dash__actions">
              {nextActions.length ? (
                nextActions.map((a) => (
                  <StudentNextActionCard
                    key={a.key}
                    type={a.type}
                    title={a.title}
                    description={a.description}
                    dueDate={a.dueDate}
                    badge={a.badge}
                    badgeVariant={a.badgeVariant}
                    actionLabel={a.actionLabel}
                    actionTo={a.actionTo}
                  />
                ))
              ) : (
                <p className="crud-muted">{t('student.dashboard.empty.assessments')}</p>
              )}
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          title={t('student.dashboard.sections.notifications')}
          actions={
            <Link to="/student/notifications" className="btn btn--outline btn--sm">
              <Bell size={16} style={{ marginInlineEnd: '0.35rem' }} aria-hidden />
              {t('student.dashboard.actions.viewNotifications')}
            </Link>
          }
        >
          {notificationsQuery.isLoading ? <LoadingSpinner /> : null}
          {notificationsQuery.isError ? (
            <p className="text-danger">{getApiErrorMessage(notificationsQuery.error, tCommon('errors.generic'))}</p>
          ) : null}
          {!notificationsQuery.isLoading && !notificationsQuery.isError ? (
            <>
              <p style={{ margin: '0 0 0.5rem', fontWeight: 700 }}>
                {tCommon('notifications')} — {unreadNotifications}
              </p>
              {notifications.length ? (
                <ul className="student-dash__mini-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {notifications.slice(0, 5).map((n) => (
                    <li key={n.id} className="student-dash__mini-row">
                      <span style={{ fontWeight: 600 }}>{n.title}</span>
                      <span className="student-dash__mini-meta">{n.is_read ? '' : t('student.dashboard.badges.pending')}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="crud-muted">{t('student.dashboard.empty.notifications')}</p>
              )}
            </>
          ) : null}
        </SectionCard>
      </div>

      <SectionCard title={t('student.dashboard.sections.programs')}>
        {enrollmentsQuery.isLoading ? <LoadingSpinner /> : null}
        {enrollmentsQuery.isError ? (
          <p className="text-danger">{getApiErrorMessage(enrollmentsQuery.error, tCommon('errors.generic'))}</p>
        ) : null}
        {!enrollmentsQuery.isLoading && !enrollmentsQuery.isError && !activeEnrollments.length ? (
          <p className="crud-muted">{t('student.dashboard.empty.enrollments')}</p>
        ) : null}
        {!enrollmentsQuery.isError && activeEnrollments.length ? (
          <div className="student-dash__actions">
            {activeEnrollments.map((e) => {
              const cohort = e.cohort;
              const mcTitle = cohort?.micro_credential?.title ?? '—';
              const cohortTitle = cohort?.title ?? '—';
              const st = String(e.enrollment_status || '');
              const statusLabel = tCommon(`status.${st}`, { defaultValue: st });
              const att = e.attendance_percentage != null ? Math.round(Number(e.attendance_percentage)) : '—';
              const progress = String(e.final_status || '') === 'passed' ? 100 : null;
              return (
                <StudentProgramCard
                  key={e.id}
                  programTitle={mcTitle}
                  cohortTitle={cohortTitle}
                  progressPercent={progress}
                  attendance={att}
                  statusLabel={statusLabel}
                  linkTo="/student/programs"
                />
              );
            })}
          </div>
        ) : null}
      </SectionCard>

      <div className="student-dash__grid-2">
        <SectionCard title={t('student.dashboard.sections.sessions')}>
          {sessionsQuery.isLoading ? <LoadingSpinner /> : null}
          {sessionsQuery.isError ? (
            <p className="text-danger">{getApiErrorMessage(sessionsQuery.error, tCommon('errors.generic'))}</p>
          ) : null}
          {!sessionsQuery.isLoading && !sessionsQuery.isError && !upcomingSessions.length ? (
            <p className="crud-muted">{t('student.dashboard.empty.sessions')}</p>
          ) : null}
          {!sessionsQuery.isError && upcomingSessions.length ? (
            <ul className="student-dash__mini-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {upcomingSessions.map((s) => (
                <li key={s.id} className="student-dash__mini-row">
                  <div>
                    <div style={{ fontWeight: 700 }}>{s.title}</div>
                    <div className="student-dash__mini-meta">
                      {s.session_date} {s.start_time} · {s.cohort?.title ?? ''}
                    </div>
                  </div>
                  <Link to="/student/sessions" className="btn btn--outline btn--sm">
                    {t('student.dashboard.actions.viewSessions')}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </SectionCard>

        <SectionCard title={t('student.dashboard.sections.attendance')}>
          {enrollmentsQuery.isLoading ? <LoadingSpinner /> : null}
          <StudentAttendanceWidget percentage={avgAttendance} />
        </SectionCard>
      </div>

      <SectionCard title={t('student.dashboard.sections.assessments')}>
        {assessmentsQuery.isLoading || submissionsQuery.isLoading ? <LoadingSpinner /> : null}
        {assessmentsQuery.isError ? (
          <p className="text-danger">{getApiErrorMessage(assessmentsQuery.error, tCommon('errors.generic'))}</p>
        ) : null}
        {submissionsQuery.isError ? (
          <p className="text-danger">{getApiErrorMessage(submissionsQuery.error, tCommon('errors.generic'))}</p>
        ) : null}
        {!assessmentsQuery.isLoading && !submissionsQuery.isLoading && !openAssessments.length ? (
          <p className="crud-muted">{t('student.dashboard.empty.assessments')}</p>
        ) : null}
        {!assessmentsQuery.isError && !submissionsQuery.isError && openAssessments.length ? (
          <div className="student-dash__mini-list">
            {openAssessments.slice(0, 10).map((a) => {
              const sub = latestSubmissionForAssessment(submissions, a.id);
              const g = grades.find((x) => x.assessment_id === a.id && x.is_final);
              const lang = i18n.language || 'ar';
              return (
                <div key={a.id} className="student-dash__mini-row">
                  <div>
                    <div style={{ fontWeight: 700 }}>{a.title}</div>
                    <div className="student-dash__mini-meta">
                      {a.assessment_type} · {formatDue(a.due_date, lang) ?? '—'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: 'flex-end' }}>
                    <span className="status-badge status-badge--neutral">
                      {sub && !submissionNeedsWork(sub)
                        ? t('student.dashboard.badges.submitted')
                        : t('student.dashboard.badges.pending')}
                    </span>
                    {g?.score != null ? (
                      <span className="status-badge status-badge--neutral">
                        {t('student.dashboard.assessmentRow.grade')}: {g.score}
                      </span>
                    ) : null}
                    <Link to="/student/assessments" className="btn btn--outline btn--sm">
                      {sub && !submissionNeedsWork(sub)
                        ? t('student.dashboard.actions.viewSubmission')
                        : t('student.dashboard.actions.submit')}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </SectionCard>

      <div className="student-dash__grid-2">
        <SectionCard title={t('student.dashboard.sections.grades')}>
          {gradesQuery.isLoading ? <LoadingSpinner /> : null}
          {gradesQuery.isError ? (
            <p className="text-danger">{getApiErrorMessage(gradesQuery.error, tCommon('errors.generic'))}</p>
          ) : null}
          {!gradesQuery.isLoading && !gradesQuery.isError ? <StudentGradeList grades={latestGrades} /> : null}
        </SectionCard>

        <SectionCard title={t('student.dashboard.sections.certificate')}>
          {certificatesQuery.isLoading ? <LoadingSpinner /> : null}
          {certificatesQuery.isError ? (
            <p className="text-danger">{getApiErrorMessage(certificatesQuery.error, tCommon('errors.generic'))}</p>
          ) : null}
          {!certificatesQuery.isLoading && !certificatesQuery.isError ? (
            <StudentCertificateEligibility
              attendancePct={avgAttendance}
              pendingSubmissionCount={pendingSubmissionCount}
              recognitionStatus={primaryRecognition}
              hasIssuedCertificate={hasIssuedCertificate}
            />
          ) : null}
        </SectionCard>
      </div>
    </div>
  );
}
