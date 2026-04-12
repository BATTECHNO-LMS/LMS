import { useMemo } from 'react';
import { FileSpreadsheet, Download, LineChart, PieChart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader, AdminActionBar, AdminStatsGrid, SectionCard } from '../../components/admin/index.js';
import { Button } from '../../components/common/Button.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { useTenant } from '../../features/tenant/index.js';
import { getTenantName } from '../../constants/tenants.js';

export function ReportsPage() {
  const { t, i18n } = useTranslation('common');
  const { filterRows, scopeId, tenantCatalog } = useTenant();
  const rows = useMemo(() => filterRows([]), [filterRows, scopeId]);

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader title={<>{t('reportsPage.title')}</>} description={<>{t('reportsPage.description')}</>} />
      <AdminActionBar>
        <Button type="button" variant="primary">
          <Download size={18} aria-hidden /> {t('reportsPage.quickExport')}
        </Button>
        <Button type="button" variant="outline">
          {t('reportsPage.schedule')}
        </Button>
      </AdminActionBar>
      <AdminStatsGrid>
        <StatCard label={t('reportsPage.statReady')} value={String(rows.length)} icon={FileSpreadsheet} />
        <StatCard label={t('reportsPage.statExports')} value="—" icon={Download} />
        <StatCard label={t('reportsPage.statTrend')} value="—" icon={LineChart} />
        <StatCard label={t('reportsPage.statDist')} value="—" icon={PieChart} />
      </AdminStatsGrid>
      <SectionCard title={<>{t('reportsPage.sectionTitle')}</>}>
        <DataTable
          emptyTitle={t('tenant.emptyForScope')}
          emptyDescription={t('tenant.emptyForScope')}
          columns={[
            { key: 'name', label: t('reportsPage.colName') },
            {
              key: 'tenantId',
              label: t('reportsPage.colTenant'),
              render: (r) =>
                getTenantName(tenantCatalog.find((x) => x.id === r.tenantId), i18n.language) || r.tenantId || '—',
            },
            { key: 'audience', label: t('reportsPage.colAudience') },
            { key: 'frequency', label: t('reportsPage.colFrequency') },
            { key: 'last', label: t('reportsPage.colLast') },
            { key: 'actions', label: t('reportsPage.colActions') },
          ]}
          rows={rows}
        />
      </SectionCard>
    </div>
  );
}
