import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Clock, Plus } from 'lucide-react';
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
import { useTenant } from '../../../features/tenant/index.js';
import { TENANT_SCOPE_ALL } from '../../../constants/tenants.js';
import { useMicroCredentials } from '../../../features/microCredentials/index.js';
import { useTracks } from '../../../features/tracks/index.js';

function mapMcRow(mc) {
  return {
    id: String(mc.id),
    title: String(mc.title ?? ''),
    code: String(mc.code ?? ''),
    level: String(mc.level ?? ''),
    hours: Number(mc.duration_hours ?? 0),
    trackName: mc.track?.name ? String(mc.track.name) : '—',
    status: String(mc.status ?? ''),
    internal_approval_status: String(mc.internal_approval_status ?? ''),
    linked_university_ids: Array.isArray(mc.linked_university_ids) ? mc.linked_university_ids.map(String) : [],
  };
}

export function MicroCredentialsListPage() {
  const { t } = useTranslation('microCredentials');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const { scopeId, isAllTenantsSelected: allTenantsSelected } = useTenant();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [trackId, setTrackId] = useState('');
  const [internalApproval, setInternalApproval] = useState('');

  const listParams = useMemo(() => {
    const p = {};
    if (status) p.status = status;
    if (trackId) p.track_id = trackId;
    if (internalApproval) p.internal_approval_status = internalApproval;
    const s = q.trim();
    if (s) p.search = s;
    return p;
  }, [status, trackId, internalApproval, q]);

  const { data: tracksData } = useTracks({}, { staleTime: 60_000 });
  const trackOptions = tracksData?.tracks ?? [];

  const { data, isLoading, isError, error } = useMicroCredentials(listParams);

  const rows = useMemo(() => {
    const list = data?.micro_credentials ?? [];
    const mapped = list.map(mapMcRow);
    if (allTenantsSelected || !scopeId || scopeId === TENANT_SCOPE_ALL) return mapped;
    return mapped.filter((r) => r.linked_university_ids.includes(String(scopeId)));
  }, [data, scopeId, allTenantsSelected]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.status === 'active').length;
    const draft = rows.filter((r) => r.status === 'draft').length;
    const hours = rows.reduce((a, r) => a + (r.hours || 0), 0);
    return { total, active, draft, hours };
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
        <Link className="btn btn--primary" to="/admin/micro-credentials/create">
          <Plus size={18} aria-hidden /> {t('add')}
        </Link>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={tCommon('actions.search')}
        />
        <SelectField id="mc-track" label={t('filters.track')} value={trackId} onChange={(e) => setTrackId(e.target.value)}>
          <option value="">{t('filters.allTracks')}</option>
          {trackOptions.map((tr) => (
            <option key={tr.id} value={tr.id}>
              {tr.name}
            </option>
          ))}
        </SelectField>
        <SelectField id="mc-status" label={tCommon('status.label')} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{tCommon('status.allStatuses')}</option>
          <option value="draft">{tCommon('status.draft')}</option>
          <option value="under_review">{t('statusOption.under_review')}</option>
          <option value="approved">{tCommon('status.approved')}</option>
          <option value="active">{tCommon('status.active')}</option>
          <option value="archived">{tCommon('status.archived')}</option>
        </SelectField>
        <SelectField
          id="mc-internal"
          label={t('filters.internalApproval')}
          value={internalApproval}
          onChange={(e) => setInternalApproval(e.target.value)}
        >
          <option value="">{t('filters.allInternal')}</option>
          <option value="not_started">not_started</option>
          <option value="in_review">in_review</option>
          <option value="approved">approved</option>
          <option value="rejected">rejected</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={t('stats.total')} value={String(stats.total)} icon={Award} />
        <StatCard label={t('stats.active')} value={String(stats.active)} icon={Award} />
        <StatCard label={t('stats.draft')} value={String(stats.draft)} icon={Award} />
        <StatCard label={t('stats.hours')} value={String(stats.hours)} icon={Clock} />
      </AdminStatsGrid>
      <SectionCard title={<>{t('listTitle')}</>}>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
            columns={[
              { key: 'title', label: t('table.title') },
              { key: 'code', label: t('table.code') },
              { key: 'level', label: t('table.level') },
              { key: 'hours', label: t('table.hours') },
              { key: 'trackName', label: t('table.track') },
              {
                key: 'internal_approval_status',
                label: t('table.internalApproval'),
                render: (r) => (
                  <StatusBadge variant={genericStatusVariant(r.internal_approval_status)}>
                    {statusLabelAr(r.internal_approval_status, locale)}
                  </StatusBadge>
                ),
              },
              {
                key: 'status',
                label: t('table.status'),
                render: (r) => (
                  <StatusBadge variant={genericStatusVariant(r.status)}>{statusLabelAr(r.status, locale)}</StatusBadge>
                ),
              },
              {
                key: 'actions',
                label: tCommon('table.actions'),
                render: (r) => (
                  <TableIconActions viewTo={`/admin/micro-credentials/${r.id}`} editTo={`/admin/micro-credentials/${r.id}/edit`} />
                ),
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
