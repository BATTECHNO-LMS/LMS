import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, MailCheck } from 'lucide-react';
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
import { ConfirmDeleteModal } from '../../../components/modals/ConfirmDeleteModal.jsx';
import { genericStatusVariant } from '../../../utils/statusMap.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { roleLabelAr } from '../../../utils/labelsAr.js';
import { useLocale } from '../../../features/locale/index.js';
import { useTenant } from '../../../features/tenant/index.js';
import { TENANT_SCOPE_ALL } from '../../../constants/tenants.js';
import {
  useUsers,
  mapUserListRow,
  useActivateUser,
  useActivateAllPendingUsers,
  useVerifyUserEmail,
  useVerifyAllUserEmails,
} from '../../../features/users/index.js';
import { Users, UserCheck, UserX, Mail, MailWarning } from 'lucide-react';

function accountStatusLabel(t, status) {
  if (status === 'active') return t('list.accountActive');
  if (status === 'suspended') return t('list.accountSuspended');
  return t('list.accountInactive');
}

export function UsersListPage() {
  const { t } = useTranslation('users');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const { filterRows, scopeId } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const status = searchParams.get('status') || '';
  const emailVerifiedFilter = searchParams.get('email_verified') || '';
  const [feedback, setFeedback] = useState('');
  const [verifyTarget, setVerifyTarget] = useState(null);
  const [verifyAllOpen, setVerifyAllOpen] = useState(false);

  const activateUser = useActivateUser();
  const activateAllPending = useActivateAllPendingUsers();
  const verifyEmail = useVerifyUserEmail();
  const verifyAllEmails = useVerifyAllUserEmails();

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
  }, [data, filterRows, scopeId, q, role]);

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
      const payload = {
        user_ids: pendingStudents.map((r) => r.id),
      };
      if (scopeId && scopeId !== TENANT_SCOPE_ALL) payload.university_id = scopeId;
      const result = await activateAllPending.mutateAsync(payload);
      const activated = result?.activated ?? 0;
      const total = result?.total_pending ?? pendingStudents.length;
      const failed = result?.failed ?? 0;
      if (failed > 0) {
        setFeedback(t('list.activateAllPartial', { activated, total, failed }));
      } else {
        setFeedback(t('list.activateAllSuccess', { count: activated }));
      }
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
      const payload = {
        user_ids: unverifiedUsers.map((r) => r.id),
      };
      if (scopeId && scopeId !== TENANT_SCOPE_ALL) payload.university_id = scopeId;
      if (status) payload.status = status;
      const result = await verifyAllEmails.mutateAsync(payload);
      const count = result?.updatedCount ?? 0;
      setFeedback(result?.message || t('list.verifyAllSuccess', { count }));
      setVerifyAllOpen(false);
    } catch (e) {
      setFeedback(getApiErrorMessage(e, tCommon('errors.generic')));
      setVerifyAllOpen(false);
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
    verifyAllEmails.isPending;

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={<>{t('title')}</>} description={<>{t('description')}</>} />
      <AdminActionBar>
        <Link className="btn btn--primary" to="/admin/users/create">
          <Plus size={18} aria-hidden /> {t('addUser')}
        </Link>
        <button
          type="button"
          className="btn btn--outline"
          disabled={busy || unverifiedUsers.length === 0}
          onClick={() => setVerifyAllOpen(true)}
        >
          <MailCheck size={18} aria-hidden /> {t('list.verifyAll')}
          {unverifiedUsers.length ? ` (${unverifiedUsers.length})` : ''}
        </button>
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
        <p className="auth-register__helper" role="status" style={{ margin: '0 0 12px' }}>
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
          pendingStudents.length > 0 ? (
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
                key: 'emailVerified',
                label: t('table.emailVerified'),
                render: (r) => (
                  <StatusBadge variant={r.emailVerified ? 'success' : 'warning'}>
                    {r.emailVerified ? t('list.emailVerified') : t('list.emailNotVerified')}
                  </StatusBadge>
                ),
              },
              {
                key: 'role',
                label: t('table.role'),
                render: (r) => roleLabelAr(r.role, locale),
              },
              {
                key: 'status',
                label: t('table.accountStatus'),
                render: (r) => {
                  const isPendingStudent =
                    r.status === 'inactive' && (Array.isArray(r.roles) ? r.roles : []).includes('student');
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                      <StatusBadge variant={genericStatusVariant(r.status)}>
                        {accountStatusLabel(t, r.status)}
                      </StatusBadge>
                      {isPendingStudent ? (
                        <StatusBadge variant="warning">{t('list.pendingActivation')}</StatusBadge>
                      ) : null}
                    </div>
                  );
                },
              },
              { key: 'lastLogin', label: t('table.lastLogin') },
              {
                key: 'actions',
                label: tCommon('table.actions'),
                render: (r) => (
                  <div className="table-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    {!r.emailVerified ? (
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        disabled={busy}
                        onClick={() => setVerifyTarget(r)}
                      >
                        {t('list.verifyEmail')}
                      </button>
                    ) : (
                      <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                        {t('list.alreadyVerified')}
                      </span>
                    )}
                    {r.status === 'inactive' && (Array.isArray(r.roles) ? r.roles : []).includes('student') ? (
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
                    <TableIconActions viewTo={`/admin/users/${r.id}`} editTo={`/admin/users/${r.id}/edit`} />
                  </div>
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
    </div>
  );
}
