import { useMemo } from 'react';
import { CalendarDays, Layers, Upload, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { MOCK_COHORTS } from '../../mocks/adminCrud.js';
import { MOCK_ATTENDANCE_SESSIONS } from '../../mocks/instructorAttendance.js';
import {
  INSTRUCTOR_ASSESSMENTS,
  INSTRUCTOR_SUBMISSION_ROWS,
} from '../../mocks/instructorAssessmentWorkspace.js';
import { useTenant } from '../../features/tenant/index.js';

export function InstructorDashboardPage() {
  const { t } = useTranslation('dashboard');
  const { t: tCommon } = useTranslation('common');
  const { filterRows, scopeId } = useTenant();

  const sessions = useMemo(() => filterRows(MOCK_ATTENDANCE_SESSIONS), [filterRows, scopeId]);
  const cohorts = useMemo(() => filterRows(MOCK_COHORTS), [filterRows, scopeId]);
  const assessments = useMemo(() => filterRows(INSTRUCTOR_ASSESSMENTS), [filterRows, scopeId]);
  const submissions = useMemo(() => filterRows(INSTRUCTOR_SUBMISSION_ROWS), [filterRows, scopeId]);
  const pendingGrading = useMemo(
    () => submissions.filter((r) => r.gradeStatus === 'pending').length,
    [submissions]
  );

  const upcomingRows = useMemo(
    () =>
      assessments.map((a) => ({
        id: a.id,
        when: a.closeDate ?? a.openDate ?? '—',
        what: a.name,
        cohort: a.cohortName ?? '—',
      })),
    [assessments]
  );

  return (
    <div className="page page--dashboard page--instructor">
      <AdminPageHeader
        title={<>{t('instructor.title')}</>}
        description={<>{t('instructor.description')}</>}
      />
      <AdminStatsGrid>
        <StatCard
          label={t('instructor.sessions')}
          value={String(sessions.length)}
          hint={t('instructor.statsHint')}
          icon={CalendarDays}
        />
        <StatCard
          label={t('instructor.cohorts')}
          value={String(cohorts.length)}
          hint={t('instructor.statsHint')}
          icon={Layers}
        />
        <StatCard
          label={t('instructor.pendingGrading')}
          value={String(pendingGrading)}
          hint={t('instructor.statsHint')}
          icon={Upload}
        />
        <StatCard label={t('instructor.alerts')} value="—" hint={t('instructor.statsHint')} icon={AlertTriangle} />
      </AdminStatsGrid>
      <SectionCard title={<>{t('instructor.upcoming')}</>}>
        <DataTable
          emptyTitle={tCommon('tenant.emptyForScope')}
          emptyDescription={tCommon('tenant.emptyGeneric')}
          columns={[
            { key: 'when', label: <>{t('instructor.table.time')}</> },
            { key: 'what', label: <>{t('instructor.table.event')}</> },
            { key: 'cohort', label: <>{t('instructor.table.cohort')}</> },
          ]}
          rows={upcomingRows}
        />
      </SectionCard>
    </div>
  );
}
