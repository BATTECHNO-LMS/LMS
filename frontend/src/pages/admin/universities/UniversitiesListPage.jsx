import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Plus, School, ShieldAlert } from 'lucide-react';
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
import { useUniversities } from '../../../features/universities/index.js';

function mapUniversityRow(u) {
  return {
    id: String(u.id),
    name: String(u.name ?? ''),
    contact: u.contact_person != null ? String(u.contact_person) : '—',
    email: u.contact_email != null ? String(u.contact_email) : '—',
    status: String(u.status ?? ''),
    programs: 0,
    tenantId: String(u.id),
  };
}

export function UniversitiesListPage() {
  const { t } = useTranslation('universities');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const { filterRows, scopeId } = useTenant();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading, isError, error } = useUniversities();

  const rows = useMemo(() => {
    const list = data?.universities ?? [];
    const mapped = list.map(mapUniversityRow);
    const scoped = filterRows(mapped);
    const qq = q.trim().toLowerCase();
    return scoped.filter((r) => {
      const matchQ =
        !qq || r.name.toLowerCase().includes(qq) || r.contact.toLowerCase().includes(qq) || r.email.toLowerCase().includes(qq);
      const matchStatus = !status || r.status === status;
      return matchQ && matchStatus;
    });
  }, [data, filterRows, scopeId, q, status]);

  const stats = {
    total: rows.length,
    active: rows.filter((r) => r.status === 'active').length,
    inactive: rows.filter((r) => r.status === 'inactive' || r.status === 'archived').length,
    programs: rows.reduce((a, r) => a + (r.programs || 0), 0),
  };

  const emptyTitle =
    rows.length === 0
      ? isError
        ? tCommon('errors.generic')
        : tCommon('tenant.emptyForScope')
      : t('empty.noResults');

  const emptyDescription =
    rows.length === 0
      ? isError
        ? String(error?.message ?? tCommon('errors.generic'))
        : t('empty.tryFilters')
      : t('empty.tryFilters');

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={<>{t('title')}</>} description={<>{t('description')}</>} />
      <AdminActionBar>
        <Link className="btn btn--primary" to="/admin/universities/create">
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
        <SelectField id="uni-status" label={tCommon('status.label')} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{tCommon('status.allStatuses')}</option>
          <option value="active">{tCommon('status.active')}</option>
          <option value="inactive">{tCommon('status.inactive')}</option>
          <option value="archived">{tCommon('status.archived')}</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={t('stats.total')} value={String(stats.total)} icon={Building2} />
        <StatCard label={t('stats.active')} value={String(stats.active)} icon={School} />
        <StatCard label={t('stats.suspended')} value={String(stats.inactive)} icon={ShieldAlert} />
        <StatCard label={t('stats.programs')} value={String(stats.programs)} icon={Building2} />
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
              { key: 'contact', label: t('table.contact') },
              { key: 'email', label: t('table.email') },
              {
                key: 'status',
                label: tCommon('status.label'),
                render: (r) => (
                  <StatusBadge variant={genericStatusVariant(r.status)}>{statusLabelAr(r.status, locale)}</StatusBadge>
                ),
              },
              { key: 'programs', label: t('table.programs') },
              {
                key: 'actions',
                label: tCommon('table.actions'),
                render: (r) => (
                  <TableIconActions viewTo={`/admin/universities/${r.id}`} editTo={`/admin/universities/${r.id}/edit`} />
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
