import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ScrollText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  AdminPageHeader,
  AdminActionBar,
  AdminFilterBar,
  AdminStatsGrid,
  SectionCard,
  SearchInput,
} from '../../components/admin/index.js';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { TableIconActions } from '../../components/crud/TableIconActions.jsx';
import { useLocale } from '../../features/locale/index.js';
import { useTenant } from '../../features/tenant/index.js';
import { useAuditLogs } from '../../features/auditLogs/hooks/useAuditLogs.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

export function AuditLogsPage() {
  const { t } = useTranslation('auditLogs');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const { scopeId, isAllTenantsSelected } = useTenant();
  const [q, setQ] = useState('');

  const params = useMemo(() => {
    const p = {};
    if (!isAllTenantsSelected && scopeId) p.university_id = scopeId;
    if (q.trim()) p.search = q.trim();
    return p;
  }, [scopeId, isAllTenantsSelected, q]);

  const { data, isLoading, isError, error } = useAuditLogs(params, { staleTime: 30_000 });
  const rows = useMemo(() => {
    const list = data?.audit_logs ?? [];
    return list.map((r) => ({
      id: r.id,
      time: r.created_at ? new Date(r.created_at).toLocaleString(locale) : '—',
      actor: r.user?.full_name ?? r.user?.email ?? '—',
      action: r.action_type,
      resource: r.entity_type,
      entityId: r.entity_id ?? '—',
      university: r.university?.name ?? '—',
    }));
  }, [data, locale]);

  const emptyTitle = isError ? tCommon('errors.generic') : t('list.emptyTitle');
  const emptyDescription = isError ? getApiErrorMessage(error, t('list.loadError')) : t('list.emptyDescription');

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader title={t('list.title')} description={t('list.description')} />
      <AdminActionBar />
      <AdminFilterBar>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('list.searchPlaceholder')}
          aria-label={tCommon('actions.search')}
        />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={t('list.stats.events')} value={String(rows.length)} icon={ScrollText} />
      </AdminStatsGrid>
      <SectionCard title={t('list.title')}>
        {isLoading ? <p className="crud-muted">{tCommon('loading')}</p> : null}
        <DataTable
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          columns={[
            { key: 'time', label: t('list.columns.time') },
            { key: 'actor', label: t('list.columns.user') },
            { key: 'action', label: t('list.columns.action') },
            { key: 'resource', label: t('list.columns.entity') },
            { key: 'entityId', label: t('list.columns.entityId') },
            { key: 'university', label: t('list.columns.university') },
            {
              key: 'actions',
              label: tCommon('actions.view'),
              render: (r) => <TableIconActions viewTo={`/admin/audit-logs/${r.id}`} />,
            },
          ]}
          rows={isError ? [] : rows}
        />
      </SectionCard>
    </div>
  );
}
