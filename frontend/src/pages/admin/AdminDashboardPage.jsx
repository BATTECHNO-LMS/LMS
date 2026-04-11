import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Building2, Layers, ClipboardList } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { useTenant } from '../../features/tenant/index.js';
import { adminCrudStore } from '../../mocks/adminCrudStore.js';
import { ADMIN_RECENT_ACTIVITY } from '../../mocks/lmsPageData.js';

export function AdminDashboardPage() {
  const { t } = useTranslation('dashboard');
  const { t: tCommon } = useTranslation('common');
  const { filterRows, scopeId } = useTenant();

  const counts = useMemo(() => {
    const users = filterRows(adminCrudStore.users.getAll());
    const unis = filterRows(adminCrudStore.universities.getAll());
    const cohorts = filterRows(adminCrudStore.cohorts.getAll());
    const assessments = filterRows(adminCrudStore.assessments.getAll());
    return {
      users: users.length,
      universities: unis.length,
      cohorts: cohorts.length,
      assessments: assessments.length,
    };
  }, [filterRows, scopeId]);

  const activityRows = useMemo(() => filterRows(ADMIN_RECENT_ACTIVITY), [filterRows, scopeId]);

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader title={<>{t('admin.title')}</>} description={<>{t('admin.description')}</>} />
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
      <SectionCard title={<>{t('admin.recentActivity')}</>}>
        <DataTable
          emptyTitle={tCommon('tenant.emptyForScope')}
          emptyDescription={t('admin.emptyActivity')}
          columns={[
            { key: 'when', label: t('admin.table.time') },
            { key: 'what', label: t('admin.table.event') },
            { key: 'actor', label: t('admin.table.actor') },
          ]}
          rows={activityRows}
        />
      </SectionCard>
    </div>
  );
}
