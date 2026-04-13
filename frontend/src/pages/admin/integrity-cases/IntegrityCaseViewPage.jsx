import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { useIntegrityCase } from '../../../features/integrity/index.js';
import { usePortalPathPrefix } from '../../../utils/portalPathPrefix.js';

export function IntegrityCaseViewPage() {
  const { id } = useParams();
  const base = usePortalPathPrefix();
  const { t } = useTranslation('integrityCases');
  const { t: tCommon } = useTranslation('common');
  const { data, isLoading, isError, error } = useIntegrityCase(id, { staleTime: 30_000 });
  const row = data?.integrity_case;

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
            <dt>{t('table.type')}</dt>
            <dd>{row.case_type}</dd>
            <dt>{t('table.student')}</dt>
            <dd>{row.student?.full_name ?? '—'}</dd>
            <dt>{t('table.cohort')}</dt>
            <dd>{row.cohort?.title ?? '—'}</dd>
            <dt>{t('table.assessment')}</dt>
            <dd>{row.assessment?.title ?? '—'}</dd>
            <dt>{t('table.status')}</dt>
            <dd>{row.status}</dd>
            <dt>{t('form.evidenceNotes')}</dt>
            <dd>{row.evidence_notes ?? '—'}</dd>
            <dt>{t('form.decision')}</dt>
            <dd>{row.decision ?? '—'}</dd>
          </dl>
        ) : null}
        <div className="form-actions" style={{ marginTop: '1rem' }}>
          <Link className="btn btn--outline" to={`${base}/integrity-cases`}>
            {t('detail.back')}
          </Link>
          {row ? (
            <Link className="btn btn--primary" to={`${base}/integrity-cases/${row.id}/edit`}>
              {tCommon('actions.edit')}
            </Link>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}
