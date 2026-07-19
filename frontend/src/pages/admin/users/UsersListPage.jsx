import { useEffect, useMemo, useState } from 'react';
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
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
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

  const listParams = useMemo(() => {
    const params = { page: 1, page_size: 500 };
    if (status) params.status = status;
    if (emailVerifiedFilter === 'true' || emailVerifiedFilter === 'false') {
      params.email_verified = emailVerifiedFilter;
    }
    if (scopeId && scopeId !== TENANT_SCOPE_ALL) params.university_id = scopeId;
    return params;
  }, [status, emailVerifiedFilter, scopeId]);

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
  }, [data, filterRows, q, role]);

  const pendingStudents = useMemo(
    () =>
      rows.filter(
        (r) => r.status === 'inactive' && (Array.isArray(r.roles) ? r.roles : []).includes('student')
      ),
    [rows]
  );

  const unverifiedUsers = useMemo(() => rows.filter((r) => !r.emailVerified), [rows]);

  const stats = {
    total: rows.length,
    emailVerified: rows.filter((r) => r.emailVerified).length,
    emailUnverified: unverifiedUsers.length,
    active: rows.filter((r) => r.status === 'active').length,
    pendingActivation: rows.filter((r) => r.status === 'inactive').length,
  };

  async function handleActivateAll() {
    if (!pendingStudents.length) {
      setFeedback(t('list.activateAllNone'));
      return;
    }
    const ok = window.confirm(t('list.activateAllConfirm', { count: pendingStudents.length }));
    if (!ok) return;

    setFeedback('');
    try {
      const payload = { user_ids: pendingStudents.map((r) => r.id) };
      if (scopeId && scopeId !== TENANT_SCOPE_ALL) payload.university_id = scopeId;
      const result = await activateAllPending.mutateAsync(payload);
      const activated = result?.activated ?? 0;
      const total = result?.total_pending ?? pendingStudents.length;
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
      const payload = { user_ids: unverifiedUsers.map((r) => r.id) };
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
      <AdminPageHeader title={<>{t('title')}</>} description={<>{t('description')}</>} />
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
            disabled={busy || unverifiedUsers.length === 0}
            onClick={() => setVerifyAllOpen(true)}
          >
            <MailCheck size={18} aria-hidden /> {t('list.verifyAll')}
            {unverifiedUsers.length ? ` (${unverifiedUsers.length})` : ''}
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
          <option value="instructor">{t('filters.instructor')}</option>
          <option value="student">{t('filters.student')}</option>
          <option value="program_admin">{t('filters.programAdminDeprecated')}</option>
          <option value="qa_officer">{t('filters.qaOfficer')}</option>
          <option value="academic_admin">{t('filters.academicReviewer')}</option>
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
      </AdminStatsGrid>
      <SectionCard
        title={<>{t('listTitle')}</>}
        actions={
          canActivate && pendingStudents.length > 0 ? (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={busy}
              onClick={handleActivateAll}
            >
              {t('list.activateAll')}
              {pendingStudents.length ? ` (${pendingStudents.length})` : ''}
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
                  {t('list.count', { count: rows.length })}
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
        message={t('list.verifyAllConfirmText', { count: unverifiedUsers.length })}
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
