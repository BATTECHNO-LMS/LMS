import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { HeartPulse, ClipboardList, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader, AdminActionBar, AdminStatsGrid, SectionCard } from '../../components/admin/index.js';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { useQaReviews } from '../../features/qa/index.js';
import { useCorrectiveActions } from '../../features/correctiveActions/index.js';
import { usePortalPathPrefix } from '../../utils/portalPathPrefix.js';

export function QAPage() {
  const base = usePortalPathPrefix();
  const { t } = useTranslation('qaReviews');
  const { t: tCa } = useTranslation('correctiveActions');
  const { t: tCommon } = useTranslation('common');

  const { data: qaData, isLoading: qaLoading } = useQaReviews({}, { staleTime: 30_000 });
  const reviews = qaData?.qa_reviews ?? [];

  const { data: caData, isLoading: caLoading } = useCorrectiveActions({}, { staleTime: 30_000 });
  const actions = caData?.corrective_actions ?? [];

  const openReviews = useMemo(
    () => reviews.filter((r) => r.status === 'open' || r.status === 'in_progress').length,
    [reviews]
  );
  const openActions = useMemo(
    () => actions.filter((a) => a.status === 'open' || a.status === 'overdue' || a.status === 'in_progress').length,
    [actions]
  );
  const closedReviews = useMemo(() => reviews.filter((r) => r.status === 'closed').length, [reviews]);

  const loading = qaLoading || caLoading;

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader title={<>{t('title')}</>} description={<>{t('description')}</>} />
      <AdminActionBar>
        <Link className="btn btn--primary" to={`${base}/qa-reviews/create`}>
          {t('add')}
        </Link>
        <Link className="btn btn--outline" to={`${base}/corrective-actions/create`}>
          {tCa('add')}
        </Link>
      </AdminActionBar>
      <AdminStatsGrid>
        <StatCard label={t('stats.total')} value={String(reviews.length)} icon={HeartPulse} />
        <StatCard label={t('stats.open')} value={String(openReviews)} icon={ClipboardList} />
        <StatCard label={tCa('stats.open')} value={String(openActions)} icon={AlertCircle} />
        <StatCard label={t('stats.closed')} value={String(closedReviews)} icon={CheckCircle2} />
      </AdminStatsGrid>
      <SectionCard title={<>{t('listTitle')}</>}>
        {loading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            emptyTitle={tCommon('emptyStates.noResultsTitle')}
            emptyDescription={tCommon('emptyStates.noResultsDescription')}
            columns={[
              { key: 'cohort', label: t('table.cohort'), render: (r) => r.cohort?.title ?? '—' },
              {
                key: 'review_date',
                label: t('table.date'),
                render: (r) => (r.review_date ? String(r.review_date).slice(0, 10) : '—'),
              },
              { key: 'review_type', label: t('table.type') },
              { key: 'status', label: t('table.status') },
            ]}
            rows={reviews}
          />
        )}
      </SectionCard>
    </div>
  );
}
