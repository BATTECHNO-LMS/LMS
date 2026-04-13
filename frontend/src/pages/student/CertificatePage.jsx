import { Award, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { UI_PERMISSION } from '../../constants/permissions.js';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { PermissionGate } from '../../components/permissions/PermissionGate.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { useCertificates } from '../../features/certificates/hooks/useCertificates.js';
import { useMemo } from 'react';
import { genericStatusVariant, statusLabelAr } from '../../utils/statusMap.js';
import { useLocale } from '../../features/locale/index.js';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

export function CertificatePage() {
  const P = UI_PERMISSION;
  const { t } = useTranslation('certificates');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const { data, isLoading, isError, error } = useCertificates({}, { staleTime: 30_000 });

  const rows = useMemo(() => {
    const list = data?.certificates ?? [];
    return list.map((c) => ({
      id: c.id,
      certificate_no: c.certificate_no,
      verification_code: c.verification_code,
      credential: c.micro_credential?.title ?? '—',
      issued: c.issued_at ? new Date(c.issued_at).toLocaleString(locale) : '—',
      status: c.status,
    }));
  }, [data, locale]);

  const issued = rows.filter((r) => r.status === 'issued').length;

  return (
    <div className="page page--dashboard page--student">
      <AdminPageHeader title={t('list.title')} description={t('list.description')} />
      <AdminStatsGrid>
        <StatCard label={t('list.stats.issued')} value={String(issued)} icon={Award} />
        <StatCard label={t('list.stats.total')} value={String(rows.length)} icon={ShieldCheck} />
      </AdminStatsGrid>
      <SectionCard title={t('list.title')}>
        <PermissionGate permission={P.canViewCertificates}>
          {isLoading ? <p className="crud-muted">{tCommon('loading')}</p> : null}
          {isError ? (
            <p className="crud-muted" role="alert">
              {getApiErrorMessage(error, t('list.loadError'))}
            </p>
          ) : null}
          <DataTable
            emptyTitle={t('list.emptyTitle')}
            emptyDescription={t('list.emptyDescription')}
            columns={[
              { key: 'certificate_no', label: t('list.columns.certificateNo') },
              { key: 'credential', label: t('list.columns.microCredential') },
              { key: 'issued', label: t('list.columns.issuedAt') },
              {
                key: 'status',
                label: t('list.columns.status'),
                render: (r) => <StatusBadge variant={genericStatusVariant(r.status)}>{statusLabelAr(r.status, locale)}</StatusBadge>,
              },
              {
                key: 'verify',
                label: t('list.verifyLink'),
                render: (r) =>
                  r.verification_code ? (
                    <Link className="btn btn--outline btn--sm" to={`/verify/certificate/${encodeURIComponent(r.verification_code)}`}>
                      {t('list.verifyLink')}
                    </Link>
                  ) : null,
              },
            ]}
            rows={rows}
          />
        </PermissionGate>
      </SectionCard>
    </div>
  );
}
