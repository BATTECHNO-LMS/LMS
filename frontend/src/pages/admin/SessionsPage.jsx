import { Link } from 'react-router-dom';
import { CalendarDays, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  AdminPageHeader,
  AdminActionBar,
  AdminStatsGrid,
  SectionCard,
} from '../../components/admin/index.js';
import { StatCard } from '../../components/common/StatCard.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { useCohorts } from '../../features/cohorts/index.js';
import { usePortalPathPrefix } from '../../utils/portalPathPrefix.js';

export function SessionsPage() {
  const base = usePortalPathPrefix();
  const { t } = useTranslation('sessions');
  const { t: tCoh } = useTranslation('cohorts');
  const { t: tCommon } = useTranslation('common');
  const { data, isLoading, isError } = useCohorts({}, { staleTime: 60_000 });
  const cohorts = data?.cohorts ?? [];

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader title={<>{t('title')}</>} description={<>{t('listTitle')}</>} />
      <AdminActionBar>
        <Link className="btn btn--outline" to={`${base}/cohorts`}>
          {tCommon('actions.backToList')}
        </Link>
      </AdminActionBar>
      <AdminStatsGrid>
        <StatCard label={t('title')} value={String(cohorts.length)} icon={CalendarDays} />
        <StatCard label={tCommon('status.active')} value={String(cohorts.filter((c) => c.status === 'active').length)} icon={Layers} />
      </AdminStatsGrid>
      <SectionCard title={<>{t('listTitle')}</>}>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            emptyTitle={isError ? tCommon('errors.generic') : t('empty')}
            emptyDescription=""
            columns={[
              { key: 'title', label: tCoh('table.title') },
              {
                key: 'sessions',
                label: t('title'),
                render: (r) => (
                  <Link className="btn btn--primary" to={`${base}/cohorts/${r.id}/sessions`}>
                    {t('listTitle')}
                  </Link>
                ),
              },
            ]}
            rows={cohorts}
          />
        )}
      </SectionCard>
    </div>
  );
}
