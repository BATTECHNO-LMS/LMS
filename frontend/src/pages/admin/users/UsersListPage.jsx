import { useEffect, useMemo, useRef, useState } from 'react';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue.js';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, MailCheck, LayoutGrid, Table2, Users, UserCheck, UserX, Mail, MailWarning, FileSpreadsheet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { AdminActionBar } from '../../../components/admin/AdminActionBar.jsx';
import { AdminFilterBar } from '../../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../../components/admin/AdminStatsGrid.jsx';
import { AdminUserCard } from '../../../components/admin/AdminUserCard.jsx';
import { UsersExcelExportModal } from '../../../components/admin/UsersExcelExportModal.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../../components/admin/SearchInput.jsx';
import { SelectField } from '../../../components/admin/SelectField.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { StatCard } from '../../../components/common/StatCard.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { TableIconActions } from '../../../components/crud/TableIconActions.jsx';
import { ConfirmDeleteModal } from '../../../components/modals/ConfirmDeleteModal.jsx';
import { genericStatusVariant } from '../../../utils/statusMap.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { roleLabelAr } from '../../../utils/labelsAr.js';
import { useLocale } from '../../../features/locale/index.js';
import { useTenant } from '../../../features/tenant/index.js';
import { useAuth } from '../../../features/auth/index.js';
import { TENANT_SCOPE_ALL } from '../../../constants/tenants.js';
import {
  useUsers,
  mapUserListRow,
  useActivateUser,
  useActivateAllPendingUsers,
  useVerifyUserEmail,
  useVerifyAllUserEmails,
  useUpdateUserStatus,
  canManageUsers,
  canActivateUsers,
  canExportUsers,
  canExportAllUniversities,
  downloadUsersExcelExport,
  saveUsersExcelBlob,
} from '../../../features/users/index.js';

const VIEW_KEY = 'battechno.admin.users.viewMode';
const USERS_PAGE_SIZE = 20;

function accountStatusLabel(t, status) {
  if (status === 'active') return t('list.accountActive');
  if (status === 'suspended') return t('list.accountSuspended');
  return t('list.accountInactive');
}

function readStoredView() {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === 'table' || v === 'cards' ? v : 'cards';
  } catch {
    return 'cards';
  }
}

export function UsersListPage() {
  const { t } = useTranslation('users');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const { user } = useAuth();
  const { filterRows, scopeId } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get('search') || '');
  const [page, setPage] = useState(() => {
    const raw = Number(searchParams.get('page') || 1);
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  });
  const debouncedQ = useDebouncedValue(q, 350);
  const [role, setRole] = useState(() => searchParams.get('role') || '');

  useEffect(() => {
    const fromUrl = searchParams.get('role') || '';
    setRole((current) => (current === fromUrl ? current : fromUrl));
  }, [searchParams]);
  const [viewMode, setViewMode] = useState(readStoredView);
  const status = searchParams.get('status') || '';
  const emailVerifiedFilter = searchParams.get('email_verified') || '';
  const [feedback, setFeedback] = useState('');
  const [verifyTarget, setVerifyTarget] = useState(null);
  const [verifyAllOpen, setVerifyAllOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const canWrite = canManageUsers(user);
  const canActivate = canActivateUsers(user);
  const canExport = canExportUsers(user);
  const canExportAll = canExportAllUniversities(user);

  const activateUser = useActivateUser();
  const activateAllPending = useActivateAllPendingUsers();
  const verifyEmail = useVerifyUserEmail();
  const verifyAllEmails = useVerifyAllUserEmails();
  const updateStatus = useUpdateUserStatus();

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, viewMode);
    } catch {
      /* ignore */
    }
  }, [viewMode]);

  const setStatusParam = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('status', value);
    else next.delete('status');
    setSearchParams(next, { replace: true });
  };

  const setEmailVerifiedParam = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('email_verified', value);
    else next.delete('email_verified');
    setSearchParams(next, { replace: true });
  };

  const filterKey = `${debouncedQ}|${status}|${role}|${emailVerifiedFilter}|${scopeId || ''}`;
  const filterKeyRef = useRef(filterKey);
  useEffect(() => {
    if (filterKeyRef.current === filterKey) return;
    filterKeyRef.current = filterKey;
    setPage(1);
  }, [filterKey]);

  const listParams = useMemo(() => {
    const params = { page, page_size: USERS_PAGE_SIZE };
    if (status) params.status = status;
    if (role) params.role = role;
    if (emailVerifiedFilter === 'true' || emailVerifiedFilter === 'false') {
      params.email_verified = emailVerifiedFilter;
    }
    if (scopeId && scopeId !== TENANT_SCOPE_ALL) params.university_id = scopeId;
    if (debouncedQ.trim()) params.search = debouncedQ.trim();
    return params;
  }, [page, status, emailVerifiedFilter, scopeId, role, debouncedQ]);

  const { data, isLoading, isError, error } = useUsers(listParams);

  const rows = useMemo(() => {
    const items = data?.items ?? [];
    return filterRows(items.map(mapUserListRow));
  }, [data, filterRows]);

  // KPI cards use `summary` (university scope only). Table pagination keeps filtered `meta.total`.
  const summary = data?.summary;
  const roleCounts = summary?.role_counts || data?.role_counts || {};
  const statusCounts = summary?.status_counts || data?.status_counts || {};
  const totalUsers =
    typeof summary?.total === 'number' ? summary.total : (data?.meta?.total ?? rows.length);
  const emailVerifiedCount =
    typeof summary?.email_verified_count === 'number'
      ? summary.email_verified_count
      : typeof data?.email_verified_count === 'number'
        ? data.email_verified_count
        : rows.filter((r) => r.emailVerified).length;
  const stats = {
    total: totalUsers,
    emailVerified: emailVerifiedCount,
    emailUnverified: Math.max(0, totalUsers - emailVerifiedCount),
    active: statusCounts.active ?? 0,
    pendingActivation: statusCounts.inactive ?? 0,
    admin: roleCounts.admin ?? 0,
    instructor: roleCounts.instructor ?? 0,
    student: roleCounts.student ?? 0,
    reviewer: roleCounts.reviewer ?? 0,
  };

  async function handleActivateAll() {
    if (!stats.pendingActivation) {
      setFeedback(t('list.activateAllNone'));
      return;
    }
    const ok = window.confirm(t('list.activateAllConfirm', { count: stats.pendingActivation }));
    if (!ok) return;

    setFeedback('');
    try {
      const payload = {};
      if (scopeId && scopeId !== TENANT_SCOPE_ALL) payload.university_id = scopeId;
      const result = await activateAllPending.mutateAsync(payload);
      const activated = result?.activated ?? 0;
      const total = result?.total_pending ?? stats.pendingActivation;
      const failed = result?.failed ?? 0;
      setFeedback(
        failed > 0
          ? t('list.activateAllPartial', { activated, total, failed })
          : t('list.activateAllSuccess', { count: activated })
      );
    } catch (e) {
      setFeedback(getApiErrorMessage(e, tCommon('errors.generic')));
    }
  }

  async function confirmVerifyOne() {
    if (!verifyTarget?.id) return;
    setFeedback('');
    try {
      const result = await verifyEmail.mutateAsync(verifyTarget.id);
      setFeedback(result?.message || t('list.verifyEmailSuccess'));
      setVerifyTarget(null);
    } catch (e) {
      setFeedback(getApiErrorMessage(e, tCommon('errors.generic')));
      setVerifyTarget(null);
    }
  }

  async function confirmVerifyAll() {
    setFeedback('');
    try {
      const payload = {};
      if (scopeId && scopeId !== TENANT_SCOPE_ALL) payload.university_id = scopeId;
      if (status) payload.status = status;
      const result = await verifyAllEmails.mutateAsync(payload);
      setFeedback(result?.message || t('list.verifyAllSuccess', { count: result?.updatedCount ?? 0 }));
      setVerifyAllOpen(false);
    } catch (e) {
      setFeedback(getApiErrorMessage(e, tCommon('errors.generic')));
      setVerifyAllOpen(false);
    }
  }

  async function confirmDeactivate() {
    if (!deactivateTarget?.id) return;
    setFeedback('');
    try {
      await updateStatus.mutateAsync({ id: deactivateTarget.id, status: 'suspended' });
      setFeedback(t('list.deactivateSuccess'));
      setDeactivateTarget(null);
    } catch (e) {
      setFeedback(getApiErrorMessage(e, tCommon('errors.generic')));
      setDeactivateTarget(null);
    }
  }

  async function handleExportConfirm({ university_id, apply_filters }) {
    setFeedback('');
    setExporting(true);
    try {
      const params = {
        university_id: university_id || undefined,
        apply_filters,
      };
      if (apply_filters) {
        if (role) params.role = role;
        if (status) params.status = status;
        if (emailVerifiedFilter === 'true' || emailVerifiedFilter === 'false') {
          params.email_verified = emailVerifiedFilter === 'true';
        }
        const qq = q.trim();
        if (qq) params.search = qq;
      }
      if (!params.university_id && scopeId && scopeId !== TENANT_SCOPE_ALL && !canExportAll) {
        params.university_id = scopeId;
      }
      const file = await downloadUsersExcelExport(params);
      saveUsersExcelBlob(file);
      setFeedback(t('export.success'));
      setExportOpen(false);
    } catch (e) {
      setFeedback(getApiErrorMessage(e, t('export.failed')));
    } finally {
      setExporting(false);
    }
  }

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

  const busy =
    activateUser.isPending ||
    activateAllPending.isPending ||
    verifyEmail.isPending ||
    verifyAllEmails.isPending ||
    updateStatus.isPending ||
    exporting;

  const defaultExportUniversityId =
    scopeId && scopeId !== TENANT_SCOPE_ALL ? scopeId : user?.universityId || user?.primary_university_id || '';

  const viewToggle = (
    <div className="admin-users-view-toggle" role="group" aria-label={t('view.toggleLabel')}>
      <button
        type="button"
        className={`btn btn--sm ${viewMode === 'cards' ? 'btn--primary' : 'btn--outline'}`}
        onClick={() => setViewMode('cards')}
      >
        <LayoutGrid size={16} aria-hidden />
        {t('view.cards')}
      </button>
      <button
        type="button"
        className={`btn btn--sm ${viewMode === 'table' ? 'btn--primary' : 'btn--outline'}`}
        onClick={() => setViewMode('table')}
      >
        <Table2 size={16} aria-hidden />
        {t('view.table')}
      </button>
    </div>
  );

  return (
    <div className="page page--dashboard page--admin crud-page page--admin-users">
      <AdminPageHeader icon={Users} title={<>{t('title')}</>} description={<>{t('description')}</>} />
      <AdminActionBar>
        {canWrite ? (
          <Link className="btn btn--primary" to="/admin/users/create">
            <Plus size={18} aria-hidden /> {t('addUser')}
          </Link>
        ) : null}
        {canExport ? (
          <button
            type="button"
            className="btn btn--outline"
            disabled={busy}
            onClick={() => setExportOpen(true)}
          >
            <FileSpreadsheet size={18} aria-hidden /> {t('export.button')}
          </button>
        ) : null}
        {canActivate ? (
          <button
            type="button"
            className="btn btn--outline"
            disabled={busy || stats.emailUnverified === 0}
            onClick={() => setVerifyAllOpen(true)}
          >
            <MailCheck size={18} aria-hidden /> {t('list.verifyAll')}
            {stats.emailUnverified ? ` (${stats.emailUnverified})` : ''}
          </button>
        ) : null}
        {viewToggle}
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
          <option value="super_admin">{t('filters.superAdmin')}</option>
          <option value="admin">{t('filters.admin')}</option>
          <option value="instructor">{t('filters.instructor')}</option>
          <option value="student">{t('filters.student')}</option>
          <option value="reviewer">{t('filters.reviewer')}</option>
        </SelectField>
        <SelectField
          id="status-filter"
          label={tCommon('status.label')}
          value={status}
          onChange={(e) => setStatusParam(e.target.value)}
        >
          <option value="">{tCommon('status.allStatuses')}</option>
          <option value="active">{t('list.accountActive')}</option>
          <option value="inactive">{t('list.accountInactive')}</option>
          <option value="suspended">{t('list.accountSuspended')}</option>
        </SelectField>
        <SelectField
          id="email-verified-filter"
          label={t('filters.emailVerification')}
          value={emailVerifiedFilter}
          onChange={(e) => setEmailVerifiedParam(e.target.value)}
        >
          <option value="">{t('filters.emailVerificationAll')}</option>
          <option value="true">{t('list.emailVerified')}</option>
          <option value="false">{t('list.emailNotVerified')}</option>
        </SelectField>
      </AdminFilterBar>
      {feedback ? (
        <p className="auth-register__helper" role="status">
          {feedback}
        </p>
      ) : null}
      <AdminStatsGrid>
        <StatCard label={t('stats.total')} value={String(stats.total)} icon={Users} />
        <StatCard label={t('stats.emailVerified')} value={String(stats.emailVerified)} icon={Mail} />
        <StatCard label={t('stats.emailUnverified')} value={String(stats.emailUnverified)} icon={MailWarning} />
        <StatCard label={t('stats.active')} value={String(stats.active)} icon={UserCheck} />
        <StatCard label={t('stats.pendingActivation')} value={String(stats.pendingActivation)} icon={UserX} />
        <StatCard label={t('filters.admin')} value={String(stats.admin)} icon={Users} />
        <StatCard label={t('filters.instructor')} value={String(stats.instructor)} icon={Users} />
        <StatCard label={t('filters.student')} value={String(stats.student)} icon={Users} />
        <StatCard label={t('filters.reviewer')} value={String(stats.reviewer)} icon={Users} />
      </AdminStatsGrid>
      <SectionCard
        title={<>{t('listTitle')}</>}
        actions={
          canActivate && stats.pendingActivation > 0 ? (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={busy}
              onClick={handleActivateAll}
            >
              {t('list.activateAll')}
              {stats.pendingActivation ? ` (${stats.pendingActivation})` : ''}
            </button>
          ) : null
        }
      >
        {isLoading ? <LoadingSpinner /> : null}

        {!isLoading && viewMode === 'cards' ? (
          rows.length ? (
            <div className="admin-users-cards-grid">
              {rows.map((r) => (
                <AdminUserCard
                  key={r.id}
                  user={r}
                  canWrite={canWrite}
                  canActivate={canActivate}
                  busy={busy}
                  onVerify={setVerifyTarget}
                  onActivate={async (u) => {
                    setFeedback('');
                    try {
                      await activateUser.mutateAsync(u.id);
                      setFeedback(t('list.activateSuccess'));
                    } catch (e) {
                      setFeedback(getApiErrorMessage(e, tCommon('errors.generic')));
                    }
                  }}
                  onDeactivate={setDeactivateTarget}
                />
              ))}
            </div>
          ) : (
            <p className="admin-users-empty">{emptyTitle}</p>
          )
        ) : null}

        {!isLoading && viewMode === 'cards' ? (
          <div className="data-table__pagination">
            <span>{t('list.count', { count: data?.meta?.total ?? rows.length })}</span>
            <button type="button" className="btn btn--outline btn--sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              {tCommon('pagination.previous')}
            </button>
            <span>{tCommon('pagination.status', { page, totalPages: data?.meta?.total_pages ?? 1 })}</span>
            <button type="button" className="btn btn--outline btn--sm" disabled={page >= (data?.meta?.total_pages ?? 1)} onClick={() => setPage((current) => current + 1)}>
              {tCommon('pagination.next')}
            </button>
          </div>
        ) : null}

        {!isLoading && viewMode === 'table' ? (
          <div className="admin-users-table-wrap">
            <DataTable
              emptyTitle={emptyTitle}
              emptyDescription={emptyDescription}
              columns={[
                { key: 'name', label: t('table.name'), mobileTitle: true, mobileVisible: true },
                { key: 'email', label: t('table.email'), mobileVisible: true },
                {
                  key: 'universityName',
                  label: t('table.university'),
                  render: (r) => r.universityName || '—',
                  mobileVisible: true,
                },
                {
                  key: 'specialtyName',
                  label: t('table.specialty'),
                  render: (r) => r.specialtyName || '—',
                },
                {
                  key: 'role',
                  label: t('table.role'),
                  render: (r) => roleLabelAr(r.role, locale),
                  mobileVisible: true,
                },
                {
                  key: 'emailVerified',
                  label: t('table.emailVerified'),
                  render: (r) => (
                    <StatusBadge variant={r.emailVerified ? 'success' : 'warning'}>
                      {r.emailVerified ? t('list.emailVerified') : t('list.emailNotVerified')}
                    </StatusBadge>
                  ),
                  mobileVisible: true,
                },
                {
                  key: 'status',
                  label: t('table.accountStatus'),
                  render: (r) => (
                    <StatusBadge variant={genericStatusVariant(r.status)}>
                      {accountStatusLabel(t, r.status)}
                    </StatusBadge>
                  ),
                  mobileVisible: true,
                },
                { key: 'lastLogin', label: t('table.lastLogin') },
                {
                  key: 'actions',
                  label: tCommon('table.actions'),
                  render: (r) => (
                    <div className="table-actions admin-users-row-actions">
                      {canActivate && !r.emailVerified ? (
                        <button
                          type="button"
                          className="btn btn--outline btn--sm"
                          disabled={busy}
                          onClick={() => setVerifyTarget(r)}
                        >
                          {t('list.verifyEmail')}
                        </button>
                      ) : null}
                      {canActivate &&
                      r.status === 'inactive' &&
                      (Array.isArray(r.roles) ? r.roles : []).includes('student') ? (
                        <button
                          type="button"
                          className="btn btn--outline btn--sm"
                          disabled={busy || !r.emailVerified}
                          title={!r.emailVerified ? t('list.activateRequiresEmail') : undefined}
                          onClick={async () => {
                            setFeedback('');
                            try {
                              await activateUser.mutateAsync(r.id);
                              setFeedback(t('list.activateSuccess'));
                            } catch (e) {
                              setFeedback(getApiErrorMessage(e, tCommon('errors.generic')));
                            }
                          }}
                        >
                          {t('list.activateAccount')}
                        </button>
                      ) : null}
                      <TableIconActions
                        viewTo={`/admin/users/${r.id}`}
                        editTo={canWrite ? `/admin/users/${r.id}/edit` : undefined}
                      />
                    </div>
                  ),
                },
              ]}
              rows={rows}
              footer={
                <div className="data-table__pagination">
                  <span>{t('list.count', { count: data?.meta?.total ?? rows.length })}</span>
                  <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    {tCommon('pagination.previous')}
                  </button>
                  <span>
                    {tCommon('pagination.status', {
                      page,
                      totalPages: data?.meta?.total_pages ?? 1,
                    })}
                  </span>
                  <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    disabled={page >= (data?.meta?.total_pages ?? 1)}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    {tCommon('pagination.next')}
                  </button>
                </div>
              }
            />
          </div>
        ) : null}
      </SectionCard>

      <ConfirmDeleteModal
        open={Boolean(verifyTarget)}
        title={t('list.verifyEmailConfirmTitle')}
        message={t('list.verifyEmailConfirmText')}
        confirmLabel={t('list.verifyEmailConfirm')}
        cancelLabel={tCommon('actions.cancel')}
        confirmVariant="primary"
        busy={verifyEmail.isPending}
        onClose={() => setVerifyTarget(null)}
        onConfirm={confirmVerifyOne}
      />

      <ConfirmDeleteModal
        open={verifyAllOpen}
        title={t('list.verifyAllConfirmTitle')}
        message={t('list.verifyAllConfirmText', { count: stats.emailUnverified })}
        confirmLabel={t('list.verifyAllConfirm')}
        cancelLabel={tCommon('actions.cancel')}
        confirmVariant="primary"
        busy={verifyAllEmails.isPending}
        onClose={() => setVerifyAllOpen(false)}
        onConfirm={confirmVerifyAll}
      />

      <ConfirmDeleteModal
        open={Boolean(deactivateTarget)}
        title={t('list.deactivateConfirmTitle')}
        message={t('list.deactivateConfirmText', { name: deactivateTarget?.name || '' })}
        confirmLabel={t('list.deactivateAccount')}
        cancelLabel={tCommon('actions.cancel')}
        confirmVariant="danger"
        busy={updateStatus.isPending}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={confirmDeactivate}
      />

      <UsersExcelExportModal
        open={exportOpen}
        busy={exporting}
        canExportAll={canExportAll}
        defaultUniversityId={defaultExportUniversityId}
        onClose={() => !exporting && setExportOpen(false)}
        onConfirm={handleExportConfirm}
      />
    </div>
  );
}
