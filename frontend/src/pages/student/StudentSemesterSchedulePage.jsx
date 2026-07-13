import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, Briefcase, CalendarDays, ClipboardList } from 'lucide-react';
import { StudentPageHeader } from '../../components/student/StudentPageHeader.jsx';
import { StudentSection } from '../../components/student/StudentSection.jsx';
import { StudentEmptyState } from '../../components/student/StudentEmptyState.jsx';
import { StudentCourseCard } from '../../components/student/StudentCourseCard.jsx';
import { SemesterFieldTrainingCard } from '../../components/student/SemesterFieldTrainingCard.jsx';
import { ProgramCard } from '../../components/student/enrollment/ProgramCard.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { useLocale } from '../../features/locale/index.js';
import {
  useSemesterSchedule,
  useStudentEnrollments,
} from '../../features/enrollments/index.js';
import { useStudentCourses } from '../../features/courses/index.js';
import { useAssessments } from '../../features/assessments/index.js';
import {
  filterUpcomingSessions,
  isOpenAssessment,
} from '../../features/student/studentDashboard.helpers.js';
import { statusLabelAr } from '../../utils/statusMap.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

const STALE = 45_000;

export function StudentSemesterSchedulePage() {
  const { t } = useTranslation('enrollments');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const isRtl = locale === 'ar';

  const scheduleQuery = useSemesterSchedule({ staleTime: STALE });
  const enrollmentsQuery = useStudentEnrollments({ staleTime: STALE });
  const coursesQuery = useStudentCourses({}, { staleTime: STALE });
  const assessmentsQuery = useAssessments(
    { page: 1, page_size: 100 },
    { staleTime: STALE }
  );

  const title = t('studentEnrollment.semesterSchedule.title');
  const description = t('studentEnrollment.semesterSchedule.subtitle');

  useEffect(() => {
    const brand = tCommon('brand');
    const prev = document.title;
    document.title = brand ? `${title} | ${brand}` : title;
    return () => {
      document.title = prev;
    };
  }, [title, tCommon]);

  const fieldTrainings = scheduleQuery.data?.field_trainings ?? [];
  const scheduleSessions = scheduleQuery.data?.schedule ?? [];

  const enrolledPrograms = useMemo(() => {
    const enrollments = enrollmentsQuery.data?.enrollments ?? [];
    return enrollments.filter((e) =>
      ['enrolled', 'completed'].includes(String(e.enrollment_status || ''))
    );
  }, [enrollmentsQuery.data]);

  const enrolledCourses = useMemo(() => {
    const courses = coursesQuery.data?.courses ?? [];
    return courses.filter((c) => Boolean(c.enrollment_status));
  }, [coursesQuery.data]);

  const programCards = useMemo(
    () =>
      enrolledPrograms.map((e) => ({
        key: e.id,
        cohortId: e.cohort_id,
        microCredentialTitle: e.cohort?.micro_credential?.title ?? '—',
        cohortTitle: e.cohort?.title ?? '—',
        status: e.enrollment_status,
        statusLabel: statusLabelAr(e.enrollment_status, locale),
        to: `/student/programs/${e.cohort_id}`,
      })),
    [enrolledPrograms, locale]
  );

  const upcomingSessions = useMemo(() => {
    const mapped = scheduleSessions.map((r, i) => ({
      id: r.session_id ?? `row-${i}`,
      title: r.session_title ?? '—',
      session_date: r.session_date,
      start_time: r.start_time,
      end_time: r.end_time,
      track: r.track?.title ?? '—',
      micro: r.micro_credential?.title ?? '—',
      cohort: r.cohort_title ?? '—',
      sessionType: r.session_type ? String(r.session_type) : '—',
      docStatus: r.documentation_status ? String(r.documentation_status) : '—',
    }));
    return filterUpcomingSessions(mapped);
  }, [scheduleSessions]);

  const openAssessments = useMemo(() => {
    const assessments = assessmentsQuery.data?.assessments ?? [];
    return assessments.filter((a) => isOpenAssessment(a));
  }, [assessmentsQuery.data]);

  const isLoading =
    scheduleQuery.isLoading ||
    enrollmentsQuery.isLoading ||
    coursesQuery.isLoading ||
    assessmentsQuery.isLoading;

  const loadError =
    (scheduleQuery.isError && getApiErrorMessage(scheduleQuery.error)) ||
    (enrollmentsQuery.isError && getApiErrorMessage(enrollmentsQuery.error)) ||
    '';

  const hasProgramsOrCourses = programCards.length > 0 || enrolledCourses.length > 0;
  const hasFieldTrainings = fieldTrainings.length > 0;
  const hasUpcomingSessions = upcomingSessions.length > 0;
  const hasOpenAssessments = openAssessments.length > 0;
  const isEmpty = !hasProgramsOrCourses && !hasFieldTrainings;

  return (
    <div className="page page--dashboard page--student page--registered-programs">
      <StudentPageHeader
        breadcrumb={t('studentEnrollment.semesterSchedule.breadcrumb')}
        title={title}
        description={description}
      />

      {isLoading ? <LoadingSpinner /> : null}
      {loadError ? <p className="form-error">{loadError}</p> : null}

      {!isLoading && !loadError && isEmpty ? (
        <StudentEmptyState
          title={t('studentEnrollment.semesterSchedule.empty')}
          description={t('studentEnrollment.semesterSchedule.emptyHint')}
          action={
            <div className="semester-schedule__empty-actions">
              <Link to="/student/courses" className="btn btn--primary btn--sm">
                {t('studentEnrollment.semesterSchedule.browseCourses')}
              </Link>
              <Link to="/student/field-training" className="btn btn--outline btn--sm">
                {t('studentEnrollment.semesterSchedule.browseFieldTraining')}
              </Link>
            </div>
          }
        />
      ) : null}

      {!isLoading && !loadError && !isEmpty ? (
        <div className="semester-schedule">
          {hasProgramsOrCourses ? (
            <StudentSection
              title={t('studentEnrollment.semesterSchedule.coursesSection')}
              icon={BookOpen}
            >
              {programCards.length > 0 ? (
                <div className="semester-schedule__grid">
                  {programCards.map((r) => (
                    <ProgramCard
                      key={r.key}
                      microCredentialTitle={r.microCredentialTitle}
                      cohortTitle={r.cohortTitle}
                      status={r.status}
                      statusLabel={r.statusLabel}
                      progressLabel={t('studentEnrollment.progressLabel')}
                      enterLabel={t('studentEnrollment.enterProgram')}
                      to={r.to}
                      isRtl={isRtl}
                    />
                  ))}
                </div>
              ) : null}

              {enrolledCourses.length > 0 ? (
                <div className="semester-schedule__grid semester-schedule__grid--courses">
                  {enrolledCourses.map((c) => (
                    <StudentCourseCard key={c.id} course={c} />
                  ))}
                </div>
              ) : null}
            </StudentSection>
          ) : null}

          {hasFieldTrainings ? (
            <StudentSection
              title={t('studentEnrollment.semesterSchedule.fieldTrainingSection')}
              icon={Briefcase}
            >
              <div className="semester-schedule__grid semester-schedule__grid--ft">
                {fieldTrainings.map((item) => (
                  <SemesterFieldTrainingCard
                    key={item.application_id || item.opportunity_id}
                    item={item}
                  />
                ))}
              </div>
            </StudentSection>
          ) : null}

          {hasUpcomingSessions ? (
            <StudentSection
              title={t('studentEnrollment.semesterSchedule.sessionsSection')}
              icon={CalendarDays}
            >
              <DataTable
                emptyTitle=""
                emptyDescription=""
                columns={[
                  {
                    key: 'track',
                    label: t('studentEnrollment.semesterSchedule.colTrack'),
                    mobileVisible: true,
                  },
                  {
                    key: 'micro',
                    label: t('studentEnrollment.semesterSchedule.colMicro'),
                    mobileVisible: true,
                  },
                  {
                    key: 'cohort',
                    label: t('studentEnrollment.semesterSchedule.colCohort'),
                    mobileVisible: true,
                  },
                  {
                    key: 'title',
                    label: t('studentEnrollment.semesterSchedule.colSession'),
                    mobileTitle: true,
                    mobileVisible: true,
                  },
                  {
                    key: 'session_date',
                    label: t('studentEnrollment.semesterSchedule.colDate'),
                    mobileSubtitle: true,
                    mobileVisible: true,
                  },
                  {
                    key: 'start_time',
                    label: t('studentEnrollment.semesterSchedule.colStart'),
                    mobileVisible: true,
                  },
                  {
                    key: 'end_time',
                    label: t('studentEnrollment.semesterSchedule.colEnd'),
                    mobileVisible: true,
                  },
                  {
                    key: 'sessionType',
                    label: t('studentEnrollment.semesterSchedule.colType'),
                    mobileVisible: true,
                  },
                  {
                    key: 'docStatus',
                    label: t('studentEnrollment.semesterSchedule.colStatus'),
                    mobileVisible: true,
                  },
                ]}
                rows={upcomingSessions}
              />
            </StudentSection>
          ) : null}

          {hasOpenAssessments ? (
            <StudentSection
              title={t('studentEnrollment.semesterSchedule.assessmentsSection')}
              icon={ClipboardList}
            >
              <ul className="semester-schedule__assessment-list">
                {openAssessments.map((a) => (
                  <li key={a.id} className="semester-schedule__assessment-item">
                    <div>
                      <p className="semester-schedule__assessment-title">{a.title}</p>
                      <p className="semester-schedule__assessment-meta">
                        {a.cohort?.title || a.due_at || a.status}
                      </p>
                    </div>
                    <Link
                      to={`/student/assessments`}
                      className="btn btn--outline btn--sm"
                    >
                      {t('studentEnrollment.semesterSchedule.openAssessment')}
                    </Link>
                  </li>
                ))}
              </ul>
            </StudentSection>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
