import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { useCorrectiveAction } from '../../../features/correctiveActions/index.js';
import { usePortalPathPrefix } from '../../../utils/portalPathPrefix.js';

export function CorrectiveActionViewPage() {
  const { id } = useParams();
  const base = usePortalPathPrefix();
  const { t } = useTranslation('correctiveActions');
  const { t: tCommon } = useTranslation('common');
  const { data, isLoading, isError, error } = useCorrectiveAction(id, { staleTime: 30_000 });
  const row = data?.corrective_action;

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={<>{t('detail.title')}</>} description={null} />
      <SectionCard>
        {isLoading ? (
          <LoadingSpinner />
        ) : isError ? (
          <p className="form-error">{String(error?.message ?? tCommon('errors.generic'))}</p>
        ) : row ? (
          <dl className="detail-list">
            <dt>{t('table.qaReview')}</dt>
            <dd>{row.qa_review?.cohort?.title ?? '—'}</dd>
            <dt>{t('table.text')}</dt>
            <dd>{row.action_text}</dd>
            <dt>{t('table.due')}</dt>
            <dd>{row.due_date ? String(row.due_date).slice(0, 10) : '—'}</dd>
            <dt>{t('table.status')}</dt>
            <dd>{row.status}</dd>
            <dt>{t('table.assignee')}</dt>
            <dd>{row.assignee?.full_name ?? '—'}</dd>
          </dl>
        ) : null}
        <div className="form-actions" style={{ marginTop: '1rem' }}>
          <Link className="btn btn--outline" to={`${base}/corrective-actions`}>
            {t('detail.back')}
          </Link>
          {row ? (
            <Link className="btn btn--primary" to={`${base}/corrective-actions/${row.id}/edit`}>
              {tCommon('actions.edit')}
            </Link>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}
