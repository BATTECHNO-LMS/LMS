import { useMemo, useState } from 'react';
import { FileSpreadsheet, Download, LineChart, PieChart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader, AdminActionBar, AdminStatsGrid, SectionCard, AdminFilterBar, SelectField } from '../../components/admin/index.js';
import { Button } from '../../components/common/Button.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { useTenant } from '../../features/tenant/index.js';
import { useReport, useExportReport } from '../../features/reports/index.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

const REPORT_TYPES = ['universities', 'cohorts', 'attendance', 'assessments', 'recognition', 'certificates'];

export function ReportsPage() {
  const { t } = useTranslation('common');
  const { scopeId, isAllTenantsSelected } = useTenant();
  const [reportType, setReportType] = useState('universities');
  const filters = useMemo(
    () => ({
      university_id: !isAllTenantsSelected && scopeId ? scopeId : undefined,
    }),
    [isAllTenantsSelected, scopeId]
  );
  const { data, isLoading, isError, error } = useReport(reportType, filters, { staleTime: 30_000 });
  const exportMutation = useExportReport();
  const rows = data?.rows ?? [];
  const summary = data?.summary ?? {};

  const columns = useMemo(() => {
    const first = rows[0];
    if (!first) return [];
    return Object.keys(first).slice(0, 8).map((key) => ({ key, label: key }));
  }, [rows]);

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader title={<>{t('reportsPage.title')}</>} description={<>{t('reportsPage.description')}</>} />
      <AdminFilterBar>
        <SelectField id="report-type" label={t('reportsPage.colName')} value={reportType} onChange={(e) => setReportType(e.target.value)}>
          {REPORT_TYPES.map((rt) => (
            <option key={rt} value={rt}>
              {rt}
            </option>
          ))}
        </SelectField>
      </AdminFilterBar>
      <AdminActionBar>
        <Button
          type="button"
          variant="primary"
          disabled={exportMutation.isPending}
          onClick={() => exportMutation.mutate({ type: reportType, format: 'csv', params: filters })}
        >
          <Download size={18} aria-hidden /> {t('reportsPage.quickExport')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={exportMutation.isPending}
          onClick={() => exportMutation.mutate({ type: reportType, format: 'json', params: filters })}
        >
          {t('reportsPage.schedule')}
        </Button>
      </AdminActionBar>
      <AdminStatsGrid>
        <StatCard label={t('reportsPage.statReady')} value={String(summary.total_rows ?? rows.length)} icon={FileSpreadsheet} />
        <StatCard label={t('reportsPage.statExports')} value={String(Object.keys(summary).length)} icon={Download} />
        <StatCard label={t('reportsPage.statTrend')} value={String(summary.average_attendance_pct ?? summary.pass_rows ?? '—')} icon={LineChart} />
        <StatCard label={t('reportsPage.statDist')} value={String(summary.issued_rows ?? summary.low_attendance_rows ?? '—')} icon={PieChart} />
      </AdminStatsGrid>
      <SectionCard title={<>{t('reportsPage.sectionTitle')}</>}>
        {isLoading ? <p className="crud-muted">{t('loading')}</p> : null}
        {isError ? <p className="crud-muted">{getApiErrorMessage(error, t('errors.generic'))}</p> : null}
        <DataTable
          emptyTitle={t('tenant.emptyForScope')}
          emptyDescription={t('tenant.emptyForScope')}
          columns={columns}
          rows={rows}
        />
      </SectionCard>
    </div>
  );
}
