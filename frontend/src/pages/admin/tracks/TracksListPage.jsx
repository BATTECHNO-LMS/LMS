import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { GitBranch, Layers, Plus, Route } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { AdminActionBar } from '../../../components/admin/AdminActionBar.jsx';
import { AdminFilterBar } from '../../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../../components/admin/SearchInput.jsx';
import { SelectField } from '../../../components/admin/SelectField.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { StatCard } from '../../../components/common/StatCard.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { TableIconActions } from '../../../components/crud/TableIconActions.jsx';
import { genericStatusVariant, statusLabelAr } from '../../../utils/statusMap.js';
import { useLocale } from '../../../features/locale/index.js';
import { useTracks } from '../../../features/tracks/index.js';

function mapTrackRow(t) {
  return {
    id: String(t.id),
    name: String(t.name ?? ''),
    code: String(t.code ?? ''),
    description: t.description != null ? String(t.description) : '',
    status: String(t.status ?? ''),
    microCount: Number(t.micro_credentials_count ?? 0),
  };
}

export function TracksListPage() {
  const { t } = useTranslation('tracks');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  const listParams = useMemo(() => {
    const p = {};
    if (status) p.status = status;
    const s = q.trim();
    if (s) p.search = s;
    return p;
  }, [status, q]);

  const { data, isLoading, isError, error } = useTracks(listParams);

  const rows = useMemo(() => {
    const list = data?.tracks ?? [];
    return list.map(mapTrackRow);
  }, [data]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.status === 'active').length;
    const inactive = rows.filter((r) => r.status === 'inactive' || r.status === 'archived').length;
    const microLinks = rows.reduce((a, r) => a + r.microCount, 0);
    return { total, active, inactive, microLinks };
  }, [rows]);

  const emptyTitle = isError ? tCommon('errors.generic') : rows.length ? t('empty.noResults') : t('empty.noRecords');
  const emptyDescription = isError
    ? String(error?.message ?? tCommon('errors.generic'))
    : rows.length
      ? t('empty.tryFilters')
      : t('empty.noRecords');

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={<>{t('title')}</>} description={<>{t('description')}</>} />
      <AdminActionBar>
        <Link className="btn btn--primary" to="/admin/tracks/create">
          <Plus size={18} aria-hidden /> {t('addTrack')}
        </Link>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={tCommon('actions.search')}
        />
        <SelectField id="track-status" label={tCommon('status.label')} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{tCommon('status.allStatuses')}</option>
          <option value="active">{tCommon('status.active')}</option>
          <option value="inactive">{tCommon('status.inactive')}</option>
          <option value="archived">{tCommon('status.archived')}</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={t('stats.total')} value={String(stats.total)} icon={Route} />
        <StatCard label={t('stats.active')} value={String(stats.active)} icon={GitBranch} />
        <StatCard label={t('stats.inactive')} value={String(stats.inactive)} icon={Layers} />
        <StatCard label={t('stats.microLinks')} value={String(stats.microLinks)} icon={Layers} />
      </AdminStatsGrid>
      <SectionCard title={<>{t('listTitle')}</>}>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
            columns={[
              { key: 'name', label: t('table.name') },
              { key: 'code', label: t('table.code') },
              {
                key: 'description',
                label: t('table.description'),
                render: (r) => (r.description ? `${r.description.slice(0, 80)}${r.description.length > 80 ? '…' : ''}` : '—'),
              },
              {
                key: 'status',
                label: t('table.status'),
                render: (r) => (
                  <StatusBadge variant={genericStatusVariant(r.status)}>{statusLabelAr(r.status, locale)}</StatusBadge>
                ),
              },
              { key: 'microCount', label: t('table.microCount') },
              {
                key: 'actions',
                label: tCommon('table.actions'),
                render: (r) => <TableIconActions viewTo={`/admin/tracks/${r.id}`} editTo={`/admin/tracks/${r.id}/edit`} />,
              },
            ]}
            rows={rows}
            footer={
              <div className="data-table__pagination">
                {tCommon('pagination.stub')}
              </div>
            }
          />
        )}
      </SectionCard>
    </div>
  );
}
