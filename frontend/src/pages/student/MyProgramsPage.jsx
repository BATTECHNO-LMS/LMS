import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StudentPageHeader } from '../../components/student/StudentPageHeader.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { ProgramCard } from '../../components/student/enrollment/ProgramCard.jsx';
import { EmptyState } from '../../components/student/enrollment/EmptyState.jsx';
import { useLocale } from '../../features/locale/index.js';
import { useStudentEnrollments } from '../../features/enrollments/index.js';
import { useAssessments } from '../../features/assessments/index.js';
import { useGrades } from '../../features/grades/index.js';
import { statusLabelAr } from '../../utils/statusMap.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

export function MyProgramsPage() {
  const { t } = useTranslation('enrollments');
  const { locale } = useLocale();
  const isRtl = locale === 'ar';

  const { data: minePayload, isLoading: mineLoading, isError: mineErr, error: mineErrorObj } = useStudentEnrollments({
    staleTime: 20_000,
  });
  const { data: assessmentsPayload, isLoading: asLoading } = useAssessments(
    { page: 1, page_size: 300 },
    { staleTime: 30_000 }
  );
  const { data: gradesPayload, isLoading: gLoading } = useGrades({}, { staleTime: 30_000 });

  const enrollments = minePayload?.enrollments ?? [];
  const activePrograms = useMemo(
    () => enrollments.filter((e) => ['enrolled', 'completed'].includes(e.enrollment_status)),
    [enrollments]
  );

  const assessments = assessmentsPayload?.assessments ?? [];
  const grades = gradesPayload?.grades ?? [];

  const rows = useMemo(() => {
    return activePrograms.map((e) => {
      const cohortId = e.cohort_id;
      const programAssessments = assessments.filter((a) => String(a.cohort_id) === String(cohortId));
      const graded = programAssessments.filter((a) => grades.some((g) => g.assessment_id === a.id)).length;
      const progress =
        programAssessments.length > 0 ? Math.round((graded / programAssessments.length) * 100) : null;
      const mcTitle = e.cohort?.micro_credential?.title ?? '—';
      const cohortTitle = e.cohort?.title ?? '—';
      return {
        key: e.id,
        cohortId,
        microCredentialTitle: mcTitle,
        cohortTitle,
        status: e.enrollment_status,
        statusLabel: statusLabelAr(e.enrollment_status, locale),
        progress,
        to: `/student/programs/${cohortId}`,
      };
    });
  }, [activePrograms, assessments, grades, locale]);

  const loading = mineLoading || asLoading || gLoading;
  const loadError = mineErr ? getApiErrorMessage(mineErrorObj) : '';

  return (
    <div className="page page--dashboard page--student">
      <StudentPageHeader title={t('studentEnrollment.programsTitle')} description={t('studentEnrollment.programsSubtitle')} />

      {loading ? <LoadingSpinner /> : null}
      {loadError ? <p className="form-error">{loadError}</p> : null}

      {!loading && !loadError && rows.length === 0 ? (
        <EmptyState title={t('studentEnrollment.noPrograms')} description={t('studentEnrollment.noProgramsHint')} />
      ) : null}

      {!loading && !loadError && rows.length > 0 ? (
        <div className="student-program-grid">
          {rows.map((r) => (
            <ProgramCard
              key={r.key}
              microCredentialTitle={r.microCredentialTitle}
              cohortTitle={r.cohortTitle}
              status={r.status}
              statusLabel={r.statusLabel}
              progressLabel={t('studentEnrollment.progressLabel')}
              progressPercent={r.progress}
              enterLabel={t('studentEnrollment.enterProgram')}
              to={r.to}
              isRtl={isRtl}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
