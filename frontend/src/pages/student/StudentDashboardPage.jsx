import { useMemo } from 'react';
import {
  BookOpen,
  Calendar,
  ClipboardList,
  Award,
  Percent,
  BarChart3,
  Bell,
  Briefcase,
  CheckCircle2,
  GraduationCap,
  ListTodo,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { useAuth } from '../../features/auth/index.js';
import { useStudentDashboardSummary } from '../../features/student/hooks/useStudentDashboardSummary.js';
import { getNotificationLink } from '../../utils/notificationDeepLink.js';
import {
  filterUpcomingSessions,
  isOpenAssessment,
  latestSubmissionForAssessment,
  submissionNeedsWork,
  averageEnrollmentAttendancePct,
  averageFinalGradePercent,
  sortGradesRecentFirst,
  averageCourseProgress,
  buildAttendanceBreakdown,
  deriveFieldTrainingNextAction,
  isActiveFieldTrainingApplication,
  friendlySectionError,
  latestGrade,
  countReadyCompletionLetters,
} from '../../features/student/studentDashboard.helpers.js';
import {
  StudentMetricCard,
  StudentNextActionCard,
  StudentProgramCard,
  StudentDashboardSkeleton,
  StudentAttendanceWidget,
  StudentGradeList,
  StudentCertificateEligibility,
  StudentProfileHeader,
  StudentCourseCard,
  StudentTrainingCard,
  StudentPageHeader,
  StudentSection,
  StudentEmptyState,
  StudentStatusBadge,
} from '../../components/student/index.js';

function formatDue(d, lng) {
  if (d == null) return null;
  const t = new Date(d).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(d).toLocaleDateString(lng, { year: 'numeric', month: 'short', day: 'numeric' });
}

function SectionError({ error, fallback }) {
  return (
    <p className="student-section-error" role="alert">
      {friendlySectionError(error, fallback)}
    </p>
  );
}

export function StudentDashboardPage() {
  const { t } = useTranslation('dashboard');
  const { t: tCommon } = useTranslation('common');
  const { t: tFt } = useTranslation('fieldTraining');
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const lang = i18n.language || 'ar';

  const summaryQuery = useStudentDashboardSummary();
  const summary = summaryQuery.data || {};

  const enrollments = summary.enrollments ?? [];
  const sessions = summary.sessions ?? [];
  const assessments = summary.assessments ?? [];
  const submissions = summary.submissions ?? [];
  const grades = summary.grades ?? [];
  const notifications = summary.notifications?.preview ?? [];
  const enrolledCourses = summary.courses ?? [];
  const ftApplications = summary.fieldTrainingApplications ?? [];
  const primaryFtProgress = summary.fieldTrainingProgress ?? null;

  const completedCourses = useMemo(
    () => enrolledCourses.filter((c) => Number(c.progress_percent) >= 100),
    [enrolledCourses]
  );
  const avgCourseProgress = useMemo(
    () => averageCourseProgress(enrolledCourses),
    [enrolledCourses]
  );

  const activeFtApps = useMemo(
    () => ftApplications.filter((a) => isActiveFieldTrainingApplication(a)),
    [ftApplications]
  );

  const primaryFtApp = activeFtApps[0] ?? null;

  const activeEnrollments = useMemo(
    () =>
      enrollments.filter((e) =>
        ['pending', 'enrolled', 'completed'].includes(String(e.enrollment_status || ''))
      ),
    [enrollments]
  );

  const upcomingSessions = useMemo(
    () => filterUpcomingSessions(sessions).slice(0, 8),
    [sessions]
  );

  const openAssessments = useMemo(
    () => assessments.filter((a) => isOpenAssessment(a)),
    [assessments]
  );

  const pendingSubmissionCount = useMemo(() => {
    let n = 0;
    for (const a of openAssessments) {
      const sub = latestSubmissionForAssessment(submissions, a.id);
      if (submissionNeedsWork(sub)) n += 1;
    }
    return n;
  }, [openAssessments, submissions]);

  const pendingFtTasks = useMemo(() => {
    return activeFtApps.filter((a) =>
      ['task_pending', 'in_training'].includes(String(a.training_status || ''))
    ).length;
  }, [activeFtApps]);

  const attendanceBreakdown = useMemo(() => buildAttendanceBreakdown(sessions), [sessions]);
  const avgAttendanceEnrollment = useMemo(
    () => averageEnrollmentAttendancePct(activeEnrollments),
    [activeEnrollments]
  );
  const avgAttendance =
    attendanceBreakdown.percentage != null
      ? attendanceBreakdown.percentage
      : avgAttendanceEnrollment;

  const avgFinal = useMemo(() => averageFinalGradePercent(grades), [grades]);
  const latestGrades = useMemo(() => sortGradesRecentFirst(grades).slice(0, 6), [grades]);
  const lastGrade = useMemo(() => latestGrade(grades), [grades]);
  const unreadNotifications = summary.notifications?.unreadCount ?? notifications.filter((x) => !x.is_read).length;
  const issuedCerts = summary.certificates?.issuedCount ?? 0;
  const readyLetters = useMemo(
    () => countReadyCompletionLetters(ftApplications),
    [ftApplications]
  );
  const hasIssuedCertificate = issuedCerts > 0;

  const primaryRecognition = useMemo(() => {
    const e = activeEnrollments[0];
    return e?.recognition_eligibility_status ?? null;
  }, [activeEnrollments]);

  const nextActions = useMemo(() => {
    const items = [];

    if (primaryFtApp) {
      const next =
        primaryFtProgress?.next_action ||
        deriveFieldTrainingNextAction(primaryFtApp, primaryFtApp.opportunity || {});
      if (next?.label_ar && next.key !== 'completed') {
        items.push({
          key: `ft-${primaryFtApp.id}`,
          type: 'alert',
          title: next.label_ar,
          description: primaryFtApp.opportunity?.title || tFt('studentTraining.nextAction'),
          dueDate: null,
          badge: t('student.dashboard.badges.pending'),
          badgeVariant: 'due',
          actionLabel: t('student.dashboard.fieldTraining.continue'),
          actionTo: `/student/field-training/${primaryFtApp.opportunity_id}`,
        });
      }
    }

    for (const a of [...openAssessments].sort(
      (x, y) => new Date(x.due_date) - new Date(y.due_date)
    )) {
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
      if (items.length >= 4) break;
    }

    const nextS = upcomingSessions[0];
    if (nextS && items.length < 5) {
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

    const courseToContinue = enrolledCourses.find((c) => Number(c.progress_percent) < 100);
    if (courseToContinue && items.length < 5) {
      items.push({
        key: `course-${courseToContinue.id}`,
        type: 'submit',
        title: t('student.dashboard.next.courseTitle', { title: courseToContinue.title }),
        description: t('student.dashboard.next.courseDesc', {
          pct: courseToContinue.progress_percent ?? 0,
        }),
        dueDate: null,
        badge: null,
        badgeVariant: 'default',
        actionLabel: t('student.dashboard.courses.continue'),
        actionTo: `/student/courses/${courseToContinue.id}`,
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
    primaryFtApp,
    primaryFtProgress,
    openAssessments,
    submissions,
    upcomingSessions,
    enrolledCourses,
    t,
    tFt,
    lang,
    avgAttendance,
    pendingSubmissionCount,
    hasIssuedCertificate,
  ]);

  const initialShellLoading = summaryQuery.isLoading && !summaryQuery.data && !summaryQuery.isError;

  if (initialShellLoading) {
    return (
      <div className="page page--dashboard page--student">
        <StudentPageHeader title={t('student.title')} description={t('student.description')} />
        <StudentDashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--student student-dash">
      <StudentPageHeader title={t('student.title')} description={t('student.description')} />

      <StudentProfileHeader user={user} />

      <AdminStatsGrid className="student-dash__kpis">
        <StudentMetricCard
          label={t('student.dashboard.kpi.courses')}
          value={String(enrolledCourses.length)}
          icon={BookOpen}
        />
        <StudentMetricCard
          label={t('student.dashboard.kpi.coursesCompleted')}
          value={String(completedCourses.length)}
          icon={CheckCircle2}
        />
        <StudentMetricCard
          label={t('student.dashboard.kpi.courseProgress')}
          value={`${avgCourseProgress}%`}
          icon={BarChart3}
        />
        <StudentMetricCard
          label={t('student.dashboard.kpi.ftActive')}
          value={String(activeFtApps.length)}
          icon={Briefcase}
        />
        <StudentMetricCard
          label={t('student.dashboard.kpi.ftTasks')}
          value={String(pendingFtTasks)}
          icon={ListTodo}
        />
        <StudentMetricCard
          label={t('student.dashboard.kpi.assessments')}
          value={String(openAssessments.length)}
          icon={ClipboardList}
        />
        <StudentMetricCard
          label={t('student.dashboard.kpi.sessions')}
          value={String(upcomingSessions.length)}
          icon={Calendar}
        />
        <StudentMetricCard
          label={t('student.dashboard.kpi.attendance')}
          value={avgAttendance == null ? '0%' : `${Math.round(avgAttendance)}%`}
          icon={Percent}
        />
        <StudentMetricCard
          label={t('student.dashboard.kpi.lastGrade')}
          value={lastGrade?.score != null ? String(lastGrade.score) : '0'}
          icon={Award}
        />
        <StudentMetricCard
          label={t('student.dashboard.kpi.certificates')}
          value={String(issuedCerts + readyLetters)}
          icon={GraduationCap}
        />
      </AdminStatsGrid>

      <StudentSection
        title={t('student.dashboard.sections.nextActions')}
        icon={Sparkles}
      >
        {nextActions.length ? (
          <div className="student-dash__actions student-dash__actions--grid">
            {nextActions.map((a) => (
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
            ))}
          </div>
        ) : (
          <StudentEmptyState title={t('student.dashboard.empty.nextActions')} />
        )}
      </StudentSection>

      <StudentSection
        title={t('student.dashboard.sections.courses')}
        icon={BookOpen}
        actions={
          <Link to="/student/courses" className="btn btn--outline btn--sm">
            {t('student.dashboard.courses.viewAll')}
          </Link>
        }
      >
        {summaryQuery.isLoading ? <LoadingSpinner /> : null}
        {summaryQuery.isError ? (
          <SectionError error={summaryQuery.error} fallback={t('student.dashboard.error.courses')} />
        ) : null}
        {!summaryQuery.isLoading && !summaryQuery.isError && !enrolledCourses.length ? (
          <StudentEmptyState title={t('student.dashboard.empty.courses')} />
        ) : null}
        {!summaryQuery.isError && enrolledCourses.length ? (
          <div className="student-portal-cards student-portal-cards--courses">
            {enrolledCourses.slice(0, 6).map((c) => (
              <StudentCourseCard key={c.id} course={c} />
            ))}
          </div>
        ) : null}
      </StudentSection>

      <StudentSection
        title={t('student.dashboard.sections.fieldTraining')}
        icon={Briefcase}
        actions={
          <Link to="/student/field-training" className="btn btn--outline btn--sm">
            {t('student.dashboard.fieldTraining.viewAll')}
          </Link>
        }
      >
        {summaryQuery.isLoading ? <LoadingSpinner /> : null}
        {summaryQuery.isError ? (
          <SectionError
            error={summaryQuery.error}
            fallback={t('student.dashboard.error.fieldTraining')}
          />
        ) : null}
        {!summaryQuery.isLoading && !summaryQuery.isError && !activeFtApps.length ? (
          <StudentEmptyState title={t('student.dashboard.empty.fieldTraining')} />
        ) : null}
        {!summaryQuery.isError && activeFtApps.length ? (
          <div className="student-portal-cards student-portal-cards--ft">
            {activeFtApps.slice(0, 3).map((app) => (
              <StudentTrainingCard
                key={app.id}
                application={app}
                progress={app.id === primaryFtApp?.id ? primaryFtProgress : null}
              />
            ))}
          </div>
        ) : null}
      </StudentSection>

      <div className="student-dash__grid-2">
        <StudentSection title={t('student.dashboard.sections.sessions')} icon={Calendar}>
          {summaryQuery.isLoading ? <LoadingSpinner /> : null}
          {summaryQuery.isError ? (
            <SectionError
              error={summaryQuery.error}
              fallback={t('student.dashboard.error.sessions')}
            />
          ) : null}
          {!summaryQuery.isLoading && !summaryQuery.isError && !upcomingSessions.length ? (
            <StudentEmptyState title={t('student.dashboard.empty.sessionsNotStarted')} />
          ) : null}
          {!summaryQuery.isError && upcomingSessions.length ? (
            <ul className="student-dash__mini-list">
              {upcomingSessions.map((s) => {
                const zoom = s.zoom_link || s.meeting_url || null;
                return (
                  <li key={s.id} className="student-dash__session-card">
                    <div>
                      <div className="student-dash__row-title">{s.title}</div>
                      <div className="student-dash__mini-meta">
                        {s.session_date} {s.start_time}
                        {s.end_time ? `–${s.end_time}` : ''} · {s.cohort?.title ?? ''}
                      </div>
                      <div className="student-dash__mini-meta">
                        {t(`student.dashboard.sessionTypes.${s.session_type}`, {
                          defaultValue: s.session_type,
                        })}
                        {s.my_attendance_status
                          ? ` · ${t(`student.dashboard.attendance.${s.my_attendance_status}`, {
                              defaultValue: s.my_attendance_status,
                            })}`
                          : ''}
                      </div>
                    </div>
                    <div className="student-dash__row-actions">
                      {zoom ? (
                        <a
                          href={zoom}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn--primary btn--sm"
                        >
                          {t('student.dashboard.actions.joinSession', {
                            defaultValue: t('student.dashboard.actions.viewSessions'),
                          })}
                        </a>
                      ) : (
                        <Link to="/student/sessions" className="btn btn--outline btn--sm">
                          {t('student.dashboard.actions.viewSessions')}
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </StudentSection>

        <StudentSection title={t('student.dashboard.sections.attendance')} icon={Percent}>
          {summaryQuery.isLoading ? <LoadingSpinner /> : null}
          {!summaryQuery.isLoading ? (
            <StudentAttendanceWidget
              percentage={avgAttendance}
              breakdown={attendanceBreakdown}
            />
          ) : null}
        </StudentSection>
      </div>

      <div className="student-dash__grid-2">
        <StudentSection title={t('student.dashboard.sections.assessments')} icon={ClipboardList}>
          {summaryQuery.isLoading ? <LoadingSpinner /> : null}
          {summaryQuery.isError ? (
            <SectionError
              error={summaryQuery.error}
              fallback={t('student.dashboard.error.assessments')}
            />
          ) : null}
          {summaryQuery.isError ? (
            <SectionError
              error={summaryQuery.error}
              fallback={t('student.dashboard.error.assessments')}
            />
          ) : null}
          {!summaryQuery.isLoading &&
          !summaryQuery.isLoading &&
          !summaryQuery.isError &&
          !summaryQuery.isError &&
          !openAssessments.length ? (
            <StudentEmptyState title={t('student.dashboard.empty.assessments')} />
          ) : null}
          {!summaryQuery.isError && !summaryQuery.isError && openAssessments.length ? (
            <ul className="student-dash__mini-list">
              {openAssessments.slice(0, 10).map((a) => {
                const sub = latestSubmissionForAssessment(submissions, a.id);
                const g = grades.find((x) => x.assessment_id === a.id && x.is_final);
                const ready = sub && !submissionNeedsWork(sub);
                return (
                  <li key={a.id} className="student-dash__session-card">
                    <div>
                      <div className="student-dash__row-title">{a.title}</div>
                      <div className="student-dash__mini-meta">
                        {a.assessment_type} · {formatDue(a.due_date, lang) ?? '—'}
                        {a.max_score != null ? ` · ${a.max_score}` : ''}
                      </div>
                    </div>
                    <div className="student-dash__row-actions">
                      <StudentStatusBadge variant={ready ? 'success' : 'warning'}>
                        {ready
                          ? t('student.dashboard.badges.submitted')
                          : t('student.dashboard.badges.pending')}
                      </StudentStatusBadge>
                      {g?.score != null ? (
                        <StudentStatusBadge variant="muted">
                          {t('student.dashboard.assessmentRow.grade')}: {g.score}
                        </StudentStatusBadge>
                      ) : null}
                      <Link
                        to="/student/assessments"
                        className={`btn btn--sm ${ready ? 'btn--outline' : 'btn--primary'}`}
                      >
                        {ready
                          ? t('student.dashboard.actions.viewSubmission')
                          : t('student.dashboard.actions.startAssessment')}
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </StudentSection>

        <StudentSection title={t('student.dashboard.sections.grades')} icon={Award}>
          {summaryQuery.isLoading ? <LoadingSpinner /> : null}
          {summaryQuery.isError ? (
            <SectionError error={summaryQuery.error} fallback={t('student.dashboard.error.grades')} />
          ) : null}
          {!summaryQuery.isLoading && !summaryQuery.isError ? (
            <StudentGradeList grades={latestGrades} />
          ) : null}
          {avgFinal != null ? (
            <p className="student-dash__avg-grade">
              {t('student.dashboard.kpi.grades')}: <strong>{avgFinal}</strong>
            </p>
          ) : null}
        </StudentSection>
      </div>

      <StudentSection title={t('student.dashboard.sections.certificate')} icon={GraduationCap}>
        {summaryQuery.isLoading ? <LoadingSpinner /> : null}
        {summaryQuery.isError ? (
          <SectionError
            error={summaryQuery.error}
            fallback={t('student.dashboard.error.certificates')}
          />
        ) : null}
        {!summaryQuery.isLoading && !summaryQuery.isError ? (
          <>
            <StudentCertificateEligibility
              attendancePct={avgAttendance}
              pendingSubmissionCount={pendingSubmissionCount}
              recognitionStatus={primaryRecognition}
              hasIssuedCertificate={hasIssuedCertificate}
            />
            {readyLetters > 0 ? (
              <p className="student-dash__letter-ready">
                {t('student.dashboard.fieldTraining.lettersReady', { count: readyLetters })}
              </p>
            ) : null}
          </>
        ) : null}
      </StudentSection>

      {activeEnrollments.length ? (
        <StudentSection title={t('student.dashboard.sections.programs')} icon={GraduationCap}>
          <div className="student-dash__actions">
            {activeEnrollments.map((e) => {
              const cohort = e.cohort;
              const mcTitle = cohort?.micro_credential?.title ?? '—';
              const cohortTitle = cohort?.title ?? '—';
              const st = String(e.enrollment_status || '');
              const statusLabel = tCommon(`status.${st}`, { defaultValue: st });
              const att =
                e.attendance_percentage != null
                  ? Math.round(Number(e.attendance_percentage))
                  : 0;
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
        </StudentSection>
      ) : null}

      <StudentSection
        title={t('student.dashboard.sections.notifications')}
        icon={Bell}
        actions={
          <Link to="/student/notifications" className="btn btn--outline btn--sm">
            {t('student.dashboard.actions.viewNotifications')}
          </Link>
        }
      >
        {summaryQuery.isLoading ? <LoadingSpinner /> : null}
        {summaryQuery.isError ? (
          <SectionError
            error={summaryQuery.error}
            fallback={t('student.dashboard.error.notifications')}
          />
        ) : null}
        {!summaryQuery.isLoading && !summaryQuery.isError ? (
          <>
            <p className="student-dash__unread">
              {t('student.dashboard.notifications.unread', { count: unreadNotifications })}
            </p>
            {notifications.length ? (
              <ul className="student-dash__mini-list">
                {notifications.slice(0, 5).map((n) => {
                  const deep = getNotificationLink(n, user);
                  return (
                    <li key={n.id} className="student-dash__session-card">
                      <div>
                        {deep ? (
                          <Link to={deep} className="student-dash__notif-link">
                            {n.title}
                          </Link>
                        ) : (
                          <span className="student-dash__row-title">{n.title}</span>
                        )}
                        <div className="student-dash__mini-meta">
                          {n.type} · {formatDue(n.created_at, lang) ?? ''}
                        </div>
                      </div>
                      <StudentStatusBadge variant={n.is_read ? 'muted' : 'warning'}>
                        {n.is_read
                          ? t('student.dashboard.notifications.read')
                          : t('student.dashboard.badges.pending')}
                      </StudentStatusBadge>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <StudentEmptyState title={t('student.dashboard.empty.notifications')} />
            )}
          </>
        ) : null}
      </StudentSection>
    </div>
  );
}
