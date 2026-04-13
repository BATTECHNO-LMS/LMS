import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Award } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import { TableIconActions } from '../../components/crud/TableIconActions.jsx';
import { useAuth } from '../../features/auth/index.js';
import { useCertificates } from '../../features/certificates/hooks/useCertificates.js';
import { genericStatusVariant, statusLabelAr } from '../../utils/statusMap.js';
import { useLocale } from '../../features/locale/index.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

export function CertificatesReviewPage() {
  const { t } = useTranslation('certificates');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const { user } = useAuth();
  const [q, setQ] = useState('');

  const listParams = useMemo(() => {
    const p = {};
    if (user?.tenantId) p.university_id = user.tenantId;
    if (q.trim()) p.search = q.trim();
    return p;
  }, [user?.tenantId, q]);

  const { data, isLoading, isError, error } = useCertificates(listParams, { staleTime: 30_000 });
  const rows = useMemo(() => {
    const list = data?.certificates ?? [];
    return list.map((c) => ({
      id: c.id,
      certificate_no: c.certificate_no,
      learner: c.student?.full_name ?? c.student?.email ?? '—',
      credential: c.micro_credential?.title ?? '—',
      issued: c.issued_at ? new Date(c.issued_at).toLocaleString(locale) : '—',
      status: c.status,
    }));
  }, [data, locale]);

  const issued = useMemo(() => (data?.certificates ?? []).filter((c) => c.status === 'issued').length, [data]);

  const emptyTitle = isError ? tCommon('errors.generic') : t('list.emptyTitle');
  const emptyDescription = isError ? getApiErrorMessage(error, t('list.loadError')) : t('list.emptyDescription');

  return (
    <div className="page page--dashboard page--reviewer">
      <AdminPageHeader title={t('list.title')} description={t('list.description')} />
      <AdminFilterBar>
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('list.searchPlaceholder')} aria-label={tCommon('actions.search')} />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={t('list.stats.issued')} value={String(issued)} icon={Award} />
        <StatCard label={t('list.stats.total')} value={String(rows.length)} icon={Award} />
      </AdminStatsGrid>
      <SectionCard title={t('list.title')}>
        {isLoading ? <p className="crud-muted">{tCommon('loading')}</p> : null}
        <DataTable
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          columns={[
            { key: 'certificate_no', label: t('list.columns.certificateNo') },
            { key: 'learner', label: t('list.columns.student') },
            { key: 'credential', label: t('list.columns.microCredential') },
            { key: 'issued', label: t('list.columns.issuedAt') },
            {
              key: 'status',
              label: t('list.columns.status'),
              render: (r) => <StatusBadge variant={genericStatusVariant(r.status)}>{statusLabelAr(r.status, locale)}</StatusBadge>,
            },
            {
              key: 'actions',
              label: t('list.columns.actions'),
              render: (r) => <TableIconActions viewTo={`/reviewer/certificates/${r.id}`} />,
            },
          ]}
          rows={isError ? [] : rows}
        />
      </SectionCard>
    </div>
  );
}
