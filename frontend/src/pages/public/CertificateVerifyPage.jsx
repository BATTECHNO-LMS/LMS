import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import { useVerifyCertificate } from '../../features/certificates/hooks/useVerifyCertificate.js';
import { genericStatusVariant, statusLabelAr } from '../../utils/statusMap.js';
import { useLocale } from '../../features/locale/index.js';

export function CertificateVerifyPage() {
  const { verificationCode } = useParams();
  const { t } = useTranslation('certificates');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const enabled = Boolean(verificationCode && verificationCode.length >= 8);
  const { data, isLoading, isError } = useVerifyCertificate(verificationCode, { enabled, retry: false });

  const inner = data?.certificate;
  const showInvalid = enabled && !isLoading && (isError || !inner);
  const showBody = enabled && !isLoading && Boolean(inner);

  return (
    <div className="page page--public" style={{ maxWidth: 640, margin: '2rem auto', padding: '0 1rem' }}>
      <SectionCard title={t('verify.title')}>
        <p className="crud-muted">{t('verify.description')}</p>
        {isLoading ? <p className="crud-muted">{tCommon('loading')}</p> : null}
        {!enabled ? <p className="crud-muted">{t('verify.shortCode')}</p> : null}
        {showInvalid ? <p className="crud-muted">{t('verify.invalid')}</p> : null}
        {showBody ? (
          <dl className="crud-dl">
            <div>
              <dt>{t('verify.certificateNo')}</dt>
              <dd>{inner.certificate_no}</dd>
            </div>
            <div>
              <dt>{t('verify.status')}</dt>
              <dd>
                <StatusBadge variant={genericStatusVariant(inner.status)}>{statusLabelAr(inner.status, locale)}</StatusBadge>
              </dd>
            </div>
            <div>
              <dt>{t('verify.issuedAt')}</dt>
              <dd>{inner.issued_at ? new Date(inner.issued_at).toLocaleString(locale) : '—'}</dd>
            </div>
            <div>
              <dt>{t('verify.microCredential')}</dt>
              <dd>{inner.micro_credential?.title ?? '—'}</dd>
            </div>
            <div>
              <dt>{t('verify.cohort')}</dt>
              <dd>{inner.cohort?.title ?? '—'}</dd>
            </div>
            <div>
              <dt>{t('verify.valid')}</dt>
              <dd>{data?.verified ? tCommon('status.active') : t('verify.notValid')}</dd>
            </div>
          </dl>
        ) : null}
        <div className="crud-view-actions" style={{ marginTop: '1rem' }}>
          <Link className="btn btn--outline" to="/login">
            {tCommon('actions.back')}
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
