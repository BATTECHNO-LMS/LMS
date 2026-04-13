import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { useQaReview } from '../../../features/qa/index.js';
import { usePortalPathPrefix } from '../../../utils/portalPathPrefix.js';

export function QAReviewViewPage() {
  const { id } = useParams();
  const base = usePortalPathPrefix();
  const { t } = useTranslation('qaReviews');
  const { t: tCa } = useTranslation('correctiveActions');
  const { t: tCommon } = useTranslation('common');
  const { data, isLoading, isError, error } = useQaReview(id, { includeCorrective: true }, { staleTime: 30_000 });
  const row = data?.qa_review;
  const corrective = data?.corrective_actions ?? [];

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
            <dt>{t('table.cohort')}</dt>
            <dd>{row.cohort?.title ?? '—'}</dd>
            <dt>{t('table.date')}</dt>
            <dd>{row.review_date ? String(row.review_date).slice(0, 10) : '—'}</dd>
            <dt>{t('table.type')}</dt>
            <dd>{row.review_type}</dd>
            <dt>{t('table.status')}</dt>
            <dd>{row.status}</dd>
            <dt>{t('form.findings')}</dt>
            <dd>{row.findings ?? '—'}</dd>
            <dt>{t('form.actionRequired')}</dt>
            <dd>{row.action_required ?? '—'}</dd>
          </dl>
        ) : null}
        <div className="form-actions" style={{ marginTop: '1rem' }}>
          <Link className="btn btn--outline" to={`${base}/qa-reviews`}>
            {t('detail.back')}
          </Link>
          {row ? (
            <>
              <Link className="btn btn--primary" to={`${base}/qa-reviews/${row.id}/edit`}>
                {tCommon('actions.edit')}
              </Link>
              <Link className="btn btn--outline" to={`${base}/corrective-actions/create?qa_review_id=${row.id}`}>
                {tCa('add')}
              </Link>
            </>
          ) : null}
        </div>
      </SectionCard>
      {corrective.length ? (
        <SectionCard title={<>{t('detail.correctiveTitle')}</>}>
          <DataTable
            columns={[
              { key: 'action_text', label: tCa('table.text') },
              { key: 'due_date', label: tCa('table.due'), render: (r) => (r.due_date ? String(r.due_date).slice(0, 10) : '—') },
              { key: 'status', label: t('table.status') },
            ]}
            rows={corrective}
          />
        </SectionCard>
      ) : null}
    </div>
  );
}
