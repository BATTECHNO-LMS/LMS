import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import { useCohorts } from '../../features/cohorts/index.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';
import { genericStatusVariant, statusLabelAr } from '../../utils/statusMap.js';
import { useLocale } from '../../features/locale/index.js';

export function MyCohortsPage() {
  const { t } = useTranslation('cohorts');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const [q, setQ] = useState('');

  const listParams = useMemo(() => {
    const p = {};
    const s = q.trim();
    if (s) p.search = s;
    return p;
  }, [q]);

  const { data, isLoading, isError, error } = useCohorts(listParams);

  const rows = useMemo(() => {
    const list = data?.cohorts ?? [];
    return list.map((c) => ({
      id: c.id,
      title: c.title,
      credential: c.micro_credential?.title ?? '—',
      capacity: c.capacity,
      status: c.status,
      locale,
    }));
  }, [data, locale]);

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.status === 'active').length;
    return { total: rows.length, active };
  }, [rows]);

  return (
    <div className="page page--dashboard page--instructor">
      <AdminPageHeader title={<>{t('title')}</>} description={<>{t('description')}</>} />
      <AdminFilterBar>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={tCommon('actions.search')}
        />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={t('stats.total')} value={String(stats.total)} icon={Layers} />
        <StatCard label={t('stats.active')} value={String(stats.active)} icon={Users} />
      </AdminStatsGrid>
      <SectionCard title={<>{t('listTitle')}</>}>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            emptyTitle={isError ? tCommon('errors.generic') : t('empty.noRecords')}
            emptyDescription={isError ? getApiErrorMessage(error, tCommon('errors.generic')) : ''}
            columns={[
              { key: 'title', label: t('table.title') },
              { key: 'credential', label: t('table.certificate') },
              { key: 'capacity', label: t('table.capacity') },
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
                  <Link className="btn btn--primary" to={`/instructor/cohorts/${r.id}`}>
                    {tCommon('actions.view')}
                  </Link>
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
