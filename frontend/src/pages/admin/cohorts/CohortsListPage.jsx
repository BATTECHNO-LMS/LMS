import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
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
import { useCohorts } from '../../../features/cohorts/index.js';
import { TENANT_SCOPE_ALL } from '../../../constants/tenants.js';

function mapRow(c, locale) {
  return {
    id: String(c.id),
    title: String(c.title ?? ''),
    credentialTitle: c.micro_credential?.title ? String(c.micro_credential.title) : '—',
    instructorName: c.instructor?.full_name ? String(c.instructor.full_name) : '—',
    capacity: c.capacity != null ? String(c.capacity) : '—',
    start_date: c.start_date ? String(c.start_date) : '—',
    end_date: c.end_date ? String(c.end_date) : '—',
    status: String(c.status ?? ''),
    locale,
  };
}

export function CohortsListPage() {
  const { t } = useTranslation('cohorts');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const { isAllTenantsSelected, currentTenantId } = useTenant();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  const listParams = useMemo(() => {
    const p = {};
    if (status) p.status = status;
    const s = q.trim();
    if (s) p.search = s;
    if (!isAllTenantsSelected && currentTenantId && currentTenantId !== TENANT_SCOPE_ALL) {
      p.university_id = currentTenantId;
    }
    return p;
  }, [status, q, isAllTenantsSelected, currentTenantId]);

  const { data, isLoading, isError, error } = useCohorts(listParams);

  const rows = useMemo(() => {
    const list = data?.cohorts ?? [];
    return list.map((c) => mapRow(c, locale));
  }, [data, locale]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.status === 'active').length;
    const planned = rows.filter((r) => r.status === 'planned').length;
    const completed = rows.filter((r) => r.status === 'completed').length;
    const open = rows.filter((r) => r.status === 'open_for_enrollment').length;
    return { total, active, planned, completed, open };
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
        <Link className="btn btn--primary" to="/admin/cohorts/create">
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
        <SelectField id="cohort-status" label={tCommon('status.label')} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{tCommon('status.allStatuses')}</option>
          <option value="planned">{t('status.planned')}</option>
          <option value="open_for_enrollment">{t('status.open_for_enrollment')}</option>
          <option value="active">{t('status.active')}</option>
          <option value="completed">{t('status.completed')}</option>
          <option value="closed">{t('status.closed')}</option>
          <option value="cancelled">{t('status.cancelled')}</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={t('stats.total')} value={String(stats.total)} icon={Users} />
        <StatCard label={t('stats.active')} value={String(stats.active)} icon={Users} />
        <StatCard label={t('stats.planned')} value={String(stats.planned)} icon={Users} />
        <StatCard label={t('stats.open')} value={String(stats.open)} icon={Users} />
        <StatCard label={t('stats.completed')} value={String(stats.completed)} icon={Users} />
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
              { key: 'credentialTitle', label: t('table.certificate') },
              { key: 'instructorName', label: t('table.trainer') },
              { key: 'capacity', label: t('table.capacity') },
              { key: 'start_date', label: t('table.startDate') },
              { key: 'end_date', label: t('table.endDate') },
              {
                key: 'status',
                label: tCommon('status.label'),
                render: (r) => (
                  <StatusBadge variant={genericStatusVariant(r.status)}>{statusLabelAr(r.status, r.locale)}</StatusBadge>
                ),
              },
              {
                key: 'actions',
                label: tCommon('table.actions'),
                render: (r) => (
                  <TableIconActions viewTo={`/admin/cohorts/${r.id}`} editTo={`/admin/cohorts/${r.id}/edit`} />
                ),
              },
            ]}
            rows={rows}
          />
        )}
      </SectionCard>
    </div>
  );
}
