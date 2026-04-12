import { useMemo } from 'react';
import { FolderOpen, Paperclip, Shield, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  AdminPageHeader,
  AdminActionBar,
  AdminFilterBar,
  AdminStatsGrid,
  SectionCard,
  SearchInput,
  SelectField,
} from '../../components/admin/index.js';
import { Button } from '../../components/common/Button.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { useTenant } from '../../features/tenant/index.js';
import { getTenantName } from '../../constants/tenants.js';

export function EvidencePage() {
  const { t, i18n } = useTranslation('common');
  const { filterRows, scopeId, tenantCatalog } = useTenant();
  const rows = useMemo(() => filterRows([]), [filterRows, scopeId]);

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader title={<>{t('evidencePage.title')}</>} description={<>{t('evidencePage.description')}</>} />
      <AdminActionBar>
        <Button type="button" variant="primary">
          {t('evidencePage.upload')}
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput placeholder={t('evidencePage.searchPlaceholder')} aria-label={t('actions.search')} />
        <SelectField id="evidence-type" label={t('status.label')} defaultValue="">
          <option value="">{t('evidencePage.allTypes')}</option>
          <option value="doc">{t('evidencePage.doc')}</option>
          <option value="media">{t('evidencePage.media')}</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={t('evidencePage.statArchived')} value={String(rows.length)} icon={FolderOpen} />
        <StatCard label={t('evidencePage.statRecent')} value="—" icon={Paperclip} />
        <StatCard label={t('evidencePage.statAssessed')} value="—" icon={Shield} />
        <StatCard label={t('evidencePage.statPending')} value="—" icon={Clock} />
      </AdminStatsGrid>
      <SectionCard title={<>{t('evidencePage.listTitle')}</>}>
        <DataTable
          emptyTitle={t('tenant.emptyForScope')}
          emptyDescription={t('tenant.emptyForScope')}
          columns={[
            { key: 'title', label: t('evidencePage.colTitle') },
            {
              key: 'tenantId',
              label: t('evidencePage.colTenant'),
              render: (r) =>
                getTenantName(tenantCatalog.find((x) => x.id === r.tenantId), i18n.language) || r.tenantId || '—',
            },
            { key: 'type', label: t('evidencePage.colType') },
          ]}
          rows={rows}
        />
      </SectionCard>
    </div>
  );
}
