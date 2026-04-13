import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Plus } from 'lucide-react';
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
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { TableIconActions } from '../../../components/crud/TableIconActions.jsx';
import { genericStatusVariant, statusLabelAr } from '../../../utils/statusMap.js';
import { useLocale } from '../../../features/locale/index.js';
import { useTenant } from '../../../features/tenant/index.js';
import { useRecognitionRequests } from '../../../features/recognition/hooks/useRecognitionRequests.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

const STATUS_OPTIONS = [
  'draft',
  'in_preparation',
  'ready_for_submission',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'needs_revision',
];

export function RecognitionRequestsListPage() {
  const { t } = useTranslation('recognition');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const { scopeId, isAllTenantsSelected } = useTenant();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  const listParams = useMemo(() => {
    const params = {};
    if (!isAllTenantsSelected && scopeId) params.university_id = scopeId;
    if (status) params.status = status;
    if (q.trim()) params.search = q.trim();
    return params;
  }, [scopeId, isAllTenantsSelected, status, q]);

  const { data, isLoading, isError, error } = useRecognitionRequests(listParams, { staleTime: 30_000 });

  const rows = useMemo(() => {
    const list = data?.recognition_requests ?? [];
    return list.map((r) => ({
      id: r.id,
      universityName: r.university?.name ?? '—',
      credentialName: r.micro_credential?.title ?? '—',
      cohortName: r.cohort?.title ?? '—',
      status: r.status,
      createdAt: r.created_at ? new Date(r.created_at).toLocaleString(locale) : '—',
    }));
  }, [data, locale]);

  const stats = useMemo(() => {
    const list = data?.recognition_requests ?? [];
    return {
      total: list.length,
      submitted: list.filter((r) => r.status === 'submitted' || r.status === 'under_review').length,
      approved: list.filter((r) => r.status === 'approved').length,
      rejected: list.filter((r) => r.status === 'rejected').length,
    };
  }, [data]);

  const emptyTitle = isError ? tCommon('errors.generic') : rows.length ? t('list.noResults') : t('list.emptyTitle');
  const emptyDescription = isError
    ? getApiErrorMessage(error, tCommon('errors.generic'))
    : rows.length
      ? t('list.noResultsDescription')
      : t('list.emptyDescription');

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={t('list.title')} description={t('list.description')} />
      <AdminActionBar>
        <Link className="btn btn--primary" to="/admin/recognition-requests/create">
          <Plus size={18} aria-hidden /> {t('list.add')}
        </Link>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('list.searchPlaceholder')}
          aria-label={tCommon('actions.search')}
        />
        <SelectField id="rec-status" label={t('list.status')} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('list.allStatuses')}</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {t(`statuses.${s}`, { defaultValue: s })}
            </option>
          ))}
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={t('list.stats.total')} value={String(stats.total)} icon={Award} />
        <StatCard label={t('list.stats.inReview')} value={String(stats.submitted)} icon={Award} />
        <StatCard label={t('list.stats.approved')} value={String(stats.approved)} icon={Award} />
        <StatCard label={t('list.stats.rejected')} value={String(stats.rejected)} icon={Award} />
      </AdminStatsGrid>
      <SectionCard title={t('list.tableTitle')}>
        {isLoading ? (
          <p className="crud-muted">{tCommon('loading')}</p>
        ) : (
          <DataTable
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
            columns={[
              { key: 'universityName', label: t('list.columns.university') },
              { key: 'credentialName', label: t('list.columns.microCredential') },
              { key: 'cohortName', label: t('list.columns.cohort') },
              { key: 'createdAt', label: t('list.columns.createdAt') },
              {
                key: 'status',
                label: t('list.columns.status'),
                render: (r) => (
                  <StatusBadge variant={genericStatusVariant(r.status)}>{statusLabelAr(r.status, locale)}</StatusBadge>
                ),
              },
              {
                key: 'actions',
                label: t('list.columns.actions'),
                render: (r) => (
                  <TableIconActions viewTo={`/admin/recognition-requests/${r.id}`} editTo={`/admin/recognition-requests/${r.id}/edit`} />
                ),
              },
            ]}
            rows={isError ? [] : rows}
          />
        )}
      </SectionCard>
    </div>
  );
}
