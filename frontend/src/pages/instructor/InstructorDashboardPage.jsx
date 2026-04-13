import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { CalendarDays, Layers, Upload, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { useCohorts } from '../../features/cohorts/index.js';
import { fetchSessionsByCohort } from '../../features/sessions/sessions.service.js';
import { sessionsKeys } from '../../features/sessions/hooks/useSessions.js';

export function InstructorDashboardPage() {
  const { t } = useTranslation('dashboard');

  const { data: cohortsPayload, isLoading: cohortsLoading } = useCohorts({}, { staleTime: 60_000 });
  const cohorts = cohortsPayload?.cohorts ?? [];
  const cohortIds = useMemo(() => cohorts.map((c) => c.id).slice(0, 30), [cohorts]);

  const sessionQueries = useQueries({
    queries: cohortIds.map((cid) => ({
      queryKey: sessionsKeys.byCohort(cid),
      queryFn: () => fetchSessionsByCohort(cid),
      enabled: Boolean(cid),
      staleTime: 30_000,
    })),
  });

  const sessionsLoading = sessionQueries.some((q) => q.isLoading);
  const sessionCount = useMemo(() => {
    let n = 0;
    for (const q of sessionQueries) {
      n += q.data?.sessions?.length ?? 0;
    }
    return n;
  }, [sessionQueries]);

  const loading = cohortsLoading || (cohortIds.length > 0 && sessionsLoading);

  return (
    <div className="page page--dashboard page--instructor">
      <AdminPageHeader title={<>{t('instructor.title')}</>} description={<>{t('instructor.description')}</>} />
      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <AdminStatsGrid>
            <StatCard
              label={t('instructor.sessions')}
              value={String(sessionCount)}
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
              value="0"
              hint={t('instructor.statsHint')}
              icon={Upload}
            />
            <StatCard label={t('instructor.alerts')} value="0" hint={t('instructor.statsHint')} icon={AlertTriangle} />
          </AdminStatsGrid>
          <SectionCard title={<>{t('instructor.upcoming')}</>}>
            <DataTable
              emptyTitle={t('instructor.upcomingEmpty')}
              emptyDescription=""
              columns={[
                { key: 'when', label: <>{t('instructor.table.time')}</> },
                { key: 'what', label: <>{t('instructor.table.event')}</> },
                { key: 'cohort', label: <>{t('instructor.table.cohort')}</> },
              ]}
              rows={[]}
            />
          </SectionCard>
        </>
      )}
    </div>
  );
}
