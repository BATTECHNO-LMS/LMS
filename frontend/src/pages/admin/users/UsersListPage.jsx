import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
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
import { roleLabelAr } from '../../../utils/labelsAr.js';
import { useLocale } from '../../../features/locale/index.js';
import { useTenant } from '../../../features/tenant/index.js';
import { TENANT_SCOPE_ALL } from '../../../constants/tenants.js';
import { useUsers, mapUserListRow } from '../../../features/users/index.js';
import { Users, UserCheck, UserX, UserPlus } from 'lucide-react';

export function UsersListPage() {
  const { t } = useTranslation('users');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const { filterRows, scopeId } = useTenant();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');

  const listParams = useMemo(() => {
    const params = { page: 1, page_size: 100 };
    if (status) params.status = status;
    if (scopeId && scopeId !== TENANT_SCOPE_ALL) params.university_id = scopeId;
    return params;
  }, [status, scopeId]);

  const { data, isLoading, isError, error } = useUsers(listParams);

  const rows = useMemo(() => {
    const items = data?.items ?? [];
    const mapped = items.map(mapUserListRow);
    const scoped = filterRows(mapped);
    const qq = q.trim().toLowerCase();
    return scoped.filter((r) => {
      const matchQ = !qq || r.name.toLowerCase().includes(qq) || r.email.toLowerCase().includes(qq);
      const matchRole = !role || (Array.isArray(r.roles) ? r.roles.includes(role) : r.role === role);
      return matchQ && matchRole;
    });
  }, [data, filterRows, scopeId, q, role]);

  const stats = {
    total: rows.length,
    active: rows.filter((r) => r.status === 'active').length,
    inactive: rows.filter((r) => r.status === 'inactive' || r.status === 'suspended').length,
    new: rows.filter((r) => r.lastLogin === '—').length,
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
        <Link className="btn btn--primary" to="/admin/users/create">
          <Plus size={18} aria-hidden /> {t('addUser')}
        </Link>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={tCommon('actions.search')}
        />
        <SelectField id="role-filter" label={t('filters.role')} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">{t('filters.allRoles')}</option>
          <option value="instructor">{t('filters.instructor')}</option>
          <option value="student">{t('filters.student')}</option>
          <option value="program_admin">{t('filters.admin')}</option>
          <option value="qa_officer">{t('filters.qaOfficer')}</option>
        </SelectField>
        <SelectField id="status-filter" label={tCommon('status.label')} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{tCommon('status.allStatuses')}</option>
          <option value="active">{tCommon('status.active')}</option>
          <option value="inactive">{tCommon('status.inactive')}</option>
          <option value="suspended">{tCommon('status.suspended')}</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={t('stats.total')} value={String(stats.total)} icon={Users} />
        <StatCard label={t('stats.active')} value={String(stats.active)} icon={UserCheck} />
        <StatCard label={t('stats.inactive')} value={String(stats.inactive)} icon={UserX} />
        <StatCard label={t('stats.newUsers')} value={String(stats.new)} icon={UserPlus} />
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
              { key: 'email', label: t('table.email') },
              {
                key: 'role',
                label: t('table.role'),
                render: (r) => roleLabelAr(r.role, locale),
              },
              {
                key: 'status',
                label: tCommon('status.label'),
                render: (r) => (
                  <StatusBadge variant={genericStatusVariant(r.status)}>{statusLabelAr(r.status, locale)}</StatusBadge>
                ),
              },
              { key: 'lastLogin', label: t('table.lastLogin') },
              {
                key: 'actions',
                label: tCommon('table.actions'),
                render: (r) => (
                  <TableIconActions viewTo={`/admin/users/${r.id}`} editTo={`/admin/users/${r.id}/edit`} />
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
