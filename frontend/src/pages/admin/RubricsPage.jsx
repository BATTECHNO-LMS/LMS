import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListChecks } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  AdminPageHeader,
  AdminActionBar,
  AdminFilterBar,
  AdminStatsGrid,
  SectionCard,
  SearchInput,
} from '../../components/admin/index.js';
import { StatCard } from '../../components/common/StatCard.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { useRubrics } from '../../features/rubrics/index.js';

export function RubricsPage() {
  const { t } = useTranslation('rubrics');
  const { t: tCommon } = useTranslation('common');
  const [q, setQ] = useState('');

  const params = useMemo(() => {
    const p = {};
    const s = q.trim();
    if (s) p.search = s;
    return p;
  }, [q]);

  const { data, isLoading, isError, error } = useRubrics(params, { staleTime: 30_000 });
  const rubrics = data?.rubrics ?? [];
  const criteriaRows = useMemo(() => rubrics.reduce((a, r) => a + (r.criteria_count ?? 0), 0), [rubrics]);

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader title={<>{t('title')}</>} description={<>{t('description')}</>} />
      <AdminActionBar>
        <Link className="btn btn--primary" to="/admin/rubrics/create">
          {t('add')}
        </Link>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={tCommon('actions.search')}
        />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={t('stats.total')} value={String(rubrics.length)} icon={ListChecks} />
        <StatCard label={t('stats.criteria')} value={String(criteriaRows)} icon={ListChecks} />
      </AdminStatsGrid>
      <SectionCard title={<>{t('listTitle')}</>}>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            emptyTitle={isError ? tCommon('errors.generic') : tCommon('emptyStates.noResultsTitle')}
            emptyDescription={isError ? String(error?.message ?? '') : tCommon('emptyStates.noResultsDescription')}
            columns={[
              { key: 'title', label: t('table.title') },
              { key: 'criteria_count', label: t('table.criteriaCount') },
              { key: 'status', label: t('table.status') },
              {
                key: 'actions',
                label: t('table.actions'),
                render: (r) => (
                  <Link className="btn btn--outline" to={`/admin/rubrics/${r.id}`}>
                    {tCommon('actions.view')}
                  </Link>
                ),
              },
            ]}
            rows={rubrics}
          />
        )}
      </SectionCard>
    </div>
  );
}
