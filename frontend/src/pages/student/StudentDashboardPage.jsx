import { useMemo } from 'react';
import { ClipboardList, Upload, Award, BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { STUDENT_ASSESSMENTS, STUDENT_SUBMISSION_ROWS } from '../../mocks/instructorAssessmentWorkspace.js';
import { useTenant } from '../../features/tenant/index.js';

export function StudentDashboardPage() {
  const { t } = useTranslation('dashboard');
  const { t: tCommon } = useTranslation('common');
  const { filterRows, scopeId } = useTenant();

  const assessments = useMemo(() => filterRows(STUDENT_ASSESSMENTS), [filterRows, scopeId]);
  const submissionRows = useMemo(() => filterRows(STUDENT_SUBMISSION_ROWS), [filterRows, scopeId]);

  const openTasks = useMemo(
    () => assessments.filter((a) => a.submissionState !== 'graded').length,
    [assessments]
  );
  const gradedCount = useMemo(
    () => assessments.filter((a) => a.submissionState === 'graded').length,
    [assessments]
  );

  const scheduleRows = useMemo(
    () =>
      assessments.map((a) => ({
        id: a.id,
        when: a.due ?? '—',
        what: a.name,
        course: '—',
      })),
    [assessments]
  );

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
        <DataTable
          emptyTitle={tCommon('tenant.emptyForScope')}
          emptyDescription={tCommon('tenant.emptyGeneric')}
          columns={[
            { key: 'when', label: <>{t('student.table.time')}</> },
            { key: 'what', label: <>{t('student.table.event')}</> },
            { key: 'course', label: <>{t('student.table.credential')}</> },
          ]}
          rows={scheduleRows}
        />
      </SectionCard>
    </div>
  );
}
