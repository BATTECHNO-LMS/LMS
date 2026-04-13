import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { useEvidenceItem } from '../../../features/evidence/index.js';
import { usePortalPathPrefix } from '../../../utils/portalPathPrefix.js';

export function EvidenceViewPage() {
  const { id } = useParams();
  const base = usePortalPathPrefix();
  const { t } = useTranslation('evidence');
  const { t: tCommon } = useTranslation('common');
  const { data, isLoading, isError, error } = useEvidenceItem(id, { staleTime: 30_000 });
  const ev = data?.evidence;

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={<>{t('detail.title')}</>} description={null} />
      <SectionCard>
        {isLoading ? (
          <LoadingSpinner />
        ) : isError ? (
          <p className="form-error">{String(error?.message ?? tCommon('errors.generic'))}</p>
        ) : ev ? (
          <dl className="detail-list">
            <dt>{t('table.title')}</dt>
            <dd>{ev.title}</dd>
            <dt>{t('table.type')}</dt>
            <dd>{ev.evidence_type}</dd>
            <dt>{t('table.cohort')}</dt>
            <dd>{ev.cohort?.title ?? '—'}</dd>
            <dt>{t('table.microCredential')}</dt>
            <dd>{ev.micro_credential?.title ?? '—'}</dd>
            <dt>{t('form.fileUrl')}</dt>
            <dd>
              <a href={ev.file_url} target="_blank" rel="noreferrer">
                {t('detail.fileLink')}
              </a>
            </dd>
          </dl>
        ) : null}
        <div className="form-actions" style={{ marginTop: '1rem' }}>
          <Link className="btn btn--outline" to={`${base}/evidence`}>
            {t('detail.back')}
          </Link>
          {ev ? (
            <Link className="btn btn--primary" to={`${base}/evidence/${ev.id}/edit`}>
              {tCommon('actions.edit')}
            </Link>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}
