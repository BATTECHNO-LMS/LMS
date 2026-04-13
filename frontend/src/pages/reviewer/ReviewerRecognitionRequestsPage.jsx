import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileBadge } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { SelectField } from '../../components/admin/SelectField.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import { TableIconActions } from '../../components/crud/TableIconActions.jsx';
import { useAuth } from '../../features/auth/index.js';
import { useRecognitionRequests } from '../../features/recognition/hooks/useRecognitionRequests.js';
import { genericStatusVariant, statusLabelAr } from '../../utils/statusMap.js';
import { useLocale } from '../../features/locale/index.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

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

export function ReviewerRecognitionRequestsPage() {
  const { t } = useTranslation('recognition');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  const listParams = useMemo(() => {
    const p = {};
    if (user?.tenantId) p.university_id = user.tenantId;
    if (status) p.status = status;
    if (q.trim()) p.search = q.trim();
    return p;
  }, [user?.tenantId, status, q]);

  const { data, isLoading, isError, error } = useRecognitionRequests(listParams, { staleTime: 30_000 });
  const rows = useMemo(() => {
    const list = data?.recognition_requests ?? [];
    return list.map((r) => ({
      id: r.id,
      universityName: r.university?.name ?? '—',
      credentialName: r.micro_credential?.title ?? '—',
      cohortName: r.cohort?.title ?? '—',
      status: r.status,
      submittedAt: r.submitted_at ? new Date(r.submitted_at).toLocaleString(locale) : '—',
    }));
  }, [data, locale]);

  const stats = useMemo(() => {
    const list = data?.recognition_requests ?? [];
    return {
      total: list.length,
      inReview: list.filter((x) => x.status === 'submitted' || x.status === 'under_review').length,
      approved: list.filter((x) => x.status === 'approved').length,
      rejected: list.filter((x) => x.status === 'rejected').length,
    };
  }, [data]);

  const emptyTitle = isError ? tCommon('errors.generic') : t('list.emptyTitle');
  const emptyDescription = isError ? getApiErrorMessage(error, t('list.loadError')) : t('list.emptyDescription');

  return (
    <div className="page page--dashboard page--reviewer">
      <AdminPageHeader title={t('title')} description={t('list.description')} />
      <AdminFilterBar>
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('list.searchPlaceholder')} aria-label={tCommon('actions.search')} />
        <SelectField id="rec-status" label={t('list.status')} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('list.allStatuses')}</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {t(`statuses.${s}`)}
            </option>
          ))}
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={t('list.stats.inReview')} value={String(stats.inReview)} icon={FileBadge} />
        <StatCard label={t('list.stats.approved')} value={String(stats.approved)} icon={FileBadge} />
        <StatCard label={t('list.stats.rejected')} value={String(stats.rejected)} icon={FileBadge} />
        <StatCard label={t('list.stats.total')} value={String(stats.total)} icon={FileBadge} />
      </AdminStatsGrid>
      <SectionCard title={t('list.tableTitle')}>
        {isLoading ? <p className="crud-muted">{tCommon('loading')}</p> : null}
        <DataTable
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          columns={[
            { key: 'universityName', label: t('list.columns.university') },
            { key: 'credentialName', label: t('list.columns.microCredential') },
            { key: 'cohortName', label: t('list.columns.cohort') },
            { key: 'submittedAt', label: t('list.columns.submittedAt') },
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
              render: (r) => <TableIconActions viewTo={`/reviewer/recognition-requests/${r.id}`} />,
            },
          ]}
          rows={isError ? [] : rows}
        />
        <div className="crud-view-actions" style={{ marginTop: '1rem' }}>
          <Link className="btn btn--outline" to="/reviewer/dashboard">
            {tCommon('actions.back')}
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
