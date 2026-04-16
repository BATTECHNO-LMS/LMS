import { useMemo } from 'react';
import { ClipboardList, Upload, Award, BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { useAssessments } from '../../features/assessments/index.js';
import { useSubmissions } from '../../features/submissions/index.js';
import { useGrades } from '../../features/grades/index.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

export function StudentDashboardPage() {
  const { t } = useTranslation('dashboard');
  const { t: tCommon } = useTranslation('common');
  const {
    data: assessmentsPayload,
    isLoading: assessmentsLoading,
    isError: assessmentsError,
    error: assessmentsErrorObj,
  } = useAssessments({}, { staleTime: 30_000 });
  const {
    data: submissionsPayload,
    isLoading: submissionsLoading,
    isError: submissionsError,
    error: submissionsErrorObj,
  } = useSubmissions({}, { staleTime: 30_000 });
  const { data: gradesPayload, isLoading: gradesLoading } = useGrades({}, { staleTime: 30_000 });

  const assessments = assessmentsPayload?.assessments ?? [];
  const submissionRows = submissionsPayload?.submissions ?? [];
  const grades = gradesPayload?.grades ?? [];

  const openTasks = useMemo(
    () => assessments.filter((a) => a.status !== 'closed' && a.status !== 'archived').length,
    [assessments]
  );
  const gradedCount = useMemo(() => grades.filter((g) => g.is_final).length, [grades]);

  const scheduleRows = useMemo(
    () =>
      assessments.map((a) => ({
        id: a.id,
        when: a.due_date ? String(a.due_date).slice(0, 10) : '—',
        what: a.title,
        course: a.micro_credential?.title ?? a.cohort?.title ?? '—',
      })),
    [assessments]
  );

  const loading = assessmentsLoading || submissionsLoading || gradesLoading;
  const loadError = assessmentsError
    ? getApiErrorMessage(assessmentsErrorObj, tCommon('errors.generic'))
    : submissionsError
      ? getApiErrorMessage(submissionsErrorObj, tCommon('errors.generic'))
      : '';

  return (
    <div className="page page--dashboard page--student">
      <AdminPageHeader
        title={<>{t('student.title')}</>}
        description={<>{t('student.description')}</>}
      />
      <AdminStatsGrid>
        <StatCard
          label={t('student.tasks')}
          value={String(openTasks)}
          hint={t('student.statsHint')}
          icon={ClipboardList}
        />
        <StatCard
          label={t('student.submissions')}
          value={String(submissionRows.length)}
          hint={t('student.statsHint')}
          icon={Upload}
        />
        <StatCard
          label={t('student.grades')}
          value={String(gradedCount)}
          hint={t('student.statsHint')}
          icon={Award}
        />
        <StatCard label={t('student.content')} value="—" hint={t('student.statsHint')} icon={BookOpen} />
      </AdminStatsGrid>
      <SectionCard title={<>{t('student.upcoming')}</>}>
        {loading ? <LoadingSpinner /> : null}
        {loadError ? <p className="crud-muted">{loadError}</p> : null}
        {!loading ? (
          <DataTable
            emptyTitle={tCommon('tenant.emptyForScope')}
            emptyDescription={tCommon('tenant.emptyGeneric')}
            columns={[
              { key: 'when', label: <>{t('student.table.time')}</> },
              { key: 'what', label: <>{t('student.table.event')}</> },
              { key: 'course', label: <>{t('student.table.credential')}</> },
            ]}
            rows={loadError ? [] : scheduleRows}
          />
        ) : null}
      </SectionCard>
    </div>
  );
}
