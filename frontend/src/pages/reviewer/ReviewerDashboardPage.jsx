import { useMemo } from 'react';
import { FileBadge, BarChart3, FolderOpen, Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { MOCK_EVIDENCE, MOCK_RECOGNITION, MOCK_REPORTS } from '../../mocks/adminCrud.js';
import { useTenant } from '../../features/tenant/index.js';

export function ReviewerDashboardPage() {
  const { t } = useTranslation('dashboard');
  const { t: tCommon } = useTranslation('common');
  const { filterRows, scopeId } = useTenant();

  const recognition = useMemo(() => filterRows(MOCK_RECOGNITION), [filterRows, scopeId]);
  const reports = useMemo(() => filterRows(MOCK_REPORTS), [filterRows, scopeId]);
  const evidence = useMemo(() => filterRows(MOCK_EVIDENCE), [filterRows, scopeId]);

  const pendingReview = useMemo(
    () => recognition.filter((r) => r.status === 'pending').length,
    [recognition]
  );

  const latestRows = useMemo(
    () =>
      recognition.map((r) => ({
        id: r.id,
        when: r.createdAt ?? '—',
        what: r.title,
        ref: r.id,
      })),
    [recognition]
  );

  return (
    <div className="page page--dashboard page--reviewer">
      <AdminPageHeader
        title={<>{t('reviewer.title')}</>}
        description={<>{t('reviewer.description')}</>}
      />
      <AdminStatsGrid>
        <StatCard
          label={t('reviewer.requests')}
          value={String(pendingReview)}
          hint={t('reviewer.statsHint')}
          icon={FileBadge}
        />
        <StatCard
          label={t('reviewer.reports')}
          value={String(reports.length)}
          hint={t('reviewer.statsHint')}
          icon={BarChart3}
        />
        <StatCard
          label={t('reviewer.evidence')}
          value={String(evidence.length)}
          hint={t('reviewer.statsHint')}
          icon={FolderOpen}
        />
        <StatCard label={t('reviewer.alerts')} value="—" hint={t('reviewer.statsHint')} icon={Bell} />
      </AdminStatsGrid>
      <SectionCard title={<>{t('reviewer.latest')}</>}>
        <DataTable
          emptyTitle={tCommon('tenant.emptyForScope')}
          emptyDescription={tCommon('tenant.emptyGeneric')}
          columns={[
            { key: 'when', label: <>{t('reviewer.table.time')}</> },
            { key: 'what', label: <>{t('reviewer.table.event')}</> },
            { key: 'ref', label: <>{t('reviewer.table.reference')}</> },
          ]}
          rows={latestRows}
        />
      </SectionCard>
    </div>
  );
}
