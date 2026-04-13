import { Link, useParams } from 'react-router-dom';
import { Plus, ClipboardCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { AdminActionBar } from '../../../components/admin/AdminActionBar.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { TableIconActions } from '../../../components/crud/TableIconActions.jsx';
import { useCohort } from '../../../features/cohorts/index.js';
import { useSessions } from '../../../features/sessions/index.js';
import { genericStatusVariant, statusLabelAr } from '../../../utils/statusMap.js';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { useLocale } from '../../../features/locale/index.js';
import { usePortalPathPrefix } from '../../../utils/portalPathPrefix.js';

export function CohortSessionsListPage() {
  const base = usePortalPathPrefix();
  const { t } = useTranslation('sessions');
  const { t: tCommon } = useTranslation('common');
  const { id } = useParams();
  const { locale } = useLocale();
  const { data: cohort, isLoading: cLoading } = useCohort(id);
  const { data: sessData, isLoading: sLoading } = useSessions(id);

  const rows = (sessData?.sessions ?? []).map((s) => ({
    ...s,
    locale,
  }));

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={<>{t('listTitle')}</>} description={cohort?.title ?? ''} />
      <AdminActionBar>
        <Link className="btn btn--primary" to={`${base}/cohorts/${id}/sessions/create`}>
          <Plus size={18} aria-hidden /> {t('create')}
        </Link>
        <Link className="btn btn--outline" to={`${base}/cohorts/${id}`}>
          {t('backToCohort')}
        </Link>
      </AdminActionBar>
      <SectionCard title={t('title')}>
        {cLoading || sLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            emptyTitle={t('empty')}
            emptyDescription=""
            columns={[
              { key: 'title', label: t('sessionTitle') },
              { key: 'session_date', label: t('sessionDate') },
              { key: 'start_time', label: t('startTime') },
              { key: 'end_time', label: t('endTime') },
              { key: 'session_type', label: t('sessionType'), render: (r) => statusLabelAr(r.session_type, r.locale) },
              {
                key: 'documentation_status',
                label: t('documentation'),
                render: (r) => (
                  <StatusBadge variant={genericStatusVariant(r.documentation_status)}>
                    {statusLabelAr(r.documentation_status, r.locale)}
                  </StatusBadge>
                ),
              },
              {
                key: 'attendance',
                label: t('attendance'),
                render: (r) => (
                  <Link className="btn btn--outline" to={`${base}/sessions/${r.id}/attendance`}>
                    <ClipboardCheck size={16} aria-hidden /> {t('attendance')}
                  </Link>
                ),
              },
              {
                key: 'actions',
                label: tCommon('table.actions'),
                render: (r) => (
                  <TableIconActions viewTo={`${base}/sessions/${r.id}`} editTo={`${base}/sessions/${r.id}/edit`} />
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
