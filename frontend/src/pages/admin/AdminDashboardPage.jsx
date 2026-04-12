import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Building2, Layers, ClipboardList } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { useUsers } from '../../features/users/index.js';
import { useUniversities } from '../../features/universities/index.js';

export function AdminDashboardPage() {
  const { t } = useTranslation('dashboard');
  const { t: tCommon } = useTranslation('common');

  const { data: usersData, isLoading: usersLoading } = useUsers({ page: 1, page_size: 1 });
  const { data: uniData, isLoading: uniLoading } = useUniversities();

  const counts = useMemo(() => {
    const userTotal = usersData?.meta?.total ?? usersData?.items?.length ?? 0;
    const uniTotal = uniData?.universities?.length ?? 0;
    return {
      users: userTotal,
      universities: uniTotal,
      cohorts: 0,
      assessments: 0,
    };
  }, [usersData, uniData]);

  const loading = usersLoading || uniLoading;

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader title={<>{t('admin.title')}</>} description={<>{t('admin.description')}</>} />
      {loading ? (
        <LoadingSpinner />
      ) : (
        <AdminStatsGrid>
          <StatCard
            label={t('admin.stats.activeUsers')}
            value={String(counts.users)}
            hint={t('admin.statsHint')}
            icon={Users}
          />
          <StatCard label={t('admin.stats.universities')} value={String(counts.universities)} hint={t('admin.statsHint')} icon={Building2} />
          <StatCard label={t('admin.stats.cohorts')} value={String(counts.cohorts)} hint={t('admin.statsHint')} icon={Layers} />
          <StatCard label={t('admin.stats.assessments')} value={String(counts.assessments)} hint={t('admin.statsHint')} icon={ClipboardList} />
        </AdminStatsGrid>
      )}
      <SectionCard title={<>{t('admin.recentActivity')}</>}>
        <DataTable
          emptyTitle={tCommon('tenant.emptyForScope')}
          emptyDescription={t('admin.emptyActivity')}
          columns={[
            { key: 'when', label: t('admin.table.time') },
            { key: 'what', label: t('admin.table.event') },
            { key: 'actor', label: t('admin.table.actor') },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
