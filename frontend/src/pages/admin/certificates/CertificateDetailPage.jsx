import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormSelect } from '../../../components/forms/index.js';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { useLocale } from '../../../features/locale/index.js';
import { useAuth } from '../../../features/auth/index.js';
import { useCertificate } from '../../../features/certificates/hooks/useCertificate.js';
import { useUpdateCertificateStatus } from '../../../features/certificates/hooks/useUpdateCertificateStatus.js';
import { genericStatusVariant, statusLabelAr } from '../../../utils/statusMap.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { canWriteCertificate } from '../../../utils/certificatePermissions.js';

const STATUSES = ['issued', 'revoked', 'superseded'];

export function CertificateDetailPage() {
  const { t } = useTranslation('certificates');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const { user } = useAuth();
  const location = useLocation();
  const { id } = useParams();
  const base = location.pathname.startsWith('/reviewer') ? '/reviewer' : '/admin';
  const { data, isLoading, isError, error } = useCertificate(id, { staleTime: 30_000 });
  const patch = useUpdateCertificateStatus();
  const [next, setNext] = useState('');
  const [err, setErr] = useState('');
  const cert = data?.certificate;
  const canWrite = canWriteCertificate(user);

  if (isLoading) {
    return (
      <div className="page page--admin crud-page">
        <p className="crud-muted">{tCommon('loading')}</p>
      </div>
    );
  }

  if (isError || !cert) {
    return (
      <div className="page page--admin crud-page">
        <AdminPageHeader title={tCommon('errors.generic')} description={getApiErrorMessage(error, '')} />
        <Link className="btn btn--primary" to={`${base}/certificates`}>
          {tCommon('actions.backToList')}
        </Link>
      </div>
    );
  }

  function onPatch(e) {
    e.preventDefault();
    setErr('');
    if (!id || !next) return;
    patch.mutate(
      { id, body: { status: next } },
      {
        onSuccess: () => setNext(''),
        onError: (er) => setErr(getApiErrorMessage(er, tCommon('errors.generic'))),
      }
    );
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={t('detail.title')} description={t('detail.description')} />
      <SectionCard title={t('detail.cardTitle')}>
        <dl className="crud-dl">
          <div>
            <dt>{t('detail.certificateNo')}</dt>
            <dd>{cert.certificate_no}</dd>
          </div>
          <div>
            <dt>{t('detail.verificationCode')}</dt>
            <dd>{cert.verification_code}</dd>
          </div>
          <div>
            <dt>{t('detail.status')}</dt>
            <dd>
              <StatusBadge variant={genericStatusVariant(cert.status)}>{statusLabelAr(cert.status, locale)}</StatusBadge>
            </dd>
          </div>
          <div>
            <dt>{t('detail.issuedAt')}</dt>
            <dd>{cert.issued_at ? new Date(cert.issued_at).toLocaleString(locale) : '—'}</dd>
          </div>
          <div>
            <dt>{t('detail.student')}</dt>
            <dd>{cert.student?.full_name ?? cert.student?.email ?? '—'}</dd>
          </div>
          <div>
            <dt>{t('detail.cohort')}</dt>
            <dd>{cert.cohort?.title ?? '—'}</dd>
          </div>
          <div>
            <dt>{t('detail.microCredential')}</dt>
            <dd>{cert.micro_credential?.title ?? '—'}</dd>
          </div>
        </dl>

        {canWrite ? (
          <form className="crud-view-actions" style={{ flexWrap: 'wrap', gap: '0.75rem' }} onSubmit={onPatch}>
            <FormSelect id="cert-status" label={t('detail.updateStatus')} value={next} onChange={(e) => setNext(e.target.value)}>
              <option value="">{t('detail.chooseStatus')}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`statuses.${s}`)}
                </option>
              ))}
            </FormSelect>
            <button type="submit" className="btn btn--outline" disabled={!next || patch.isPending}>
              {t('detail.apply')}
            </button>
            {err ? (
              <p className="crud-muted" role="alert">
                {err}
              </p>
            ) : null}
          </form>
        ) : null}

        <div className="crud-view-actions">
          <Link className="btn btn--outline" to={`${base}/certificates`}>
            {tCommon('actions.backToList')}
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
