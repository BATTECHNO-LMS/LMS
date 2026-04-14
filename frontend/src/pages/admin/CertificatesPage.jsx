import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Award } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  AdminPageHeader,
  AdminActionBar,
  AdminFilterBar,
  AdminStatsGrid,
  SectionCard,
  SearchInput,
  SelectField,
} from '../../components/admin/index.js';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { TableIconActions } from '../../components/crud/TableIconActions.jsx';
import { useLocale } from '../../features/locale/index.js';
import { useTenant } from '../../features/tenant/index.js';
import { useCertificates } from '../../features/certificates/hooks/useCertificates.js';
import { useAuth } from '../../features/auth/index.js';
import { genericStatusVariant, statusLabelAr } from '../../utils/statusMap.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';
import { canWriteCertificate } from '../../utils/certificatePermissions.js';

export function CertificatesPage() {
  const { t } = useTranslation('certificates');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { scopeId, isAllTenantsSelected } = useTenant();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  const params = useMemo(() => {
    const p = {};
    if (!isAllTenantsSelected && scopeId) {
      p.university_id = scopeId;
    }
    if (status) p.status = status;
    if (q.trim()) p.search = q.trim();
    return p;
  }, [scopeId, isAllTenantsSelected, status, q]);

  const { data, isLoading, isError, error } = useCertificates(params, { staleTime: 30_000 });
  const rows = useMemo(() => {
    const list = data?.certificates ?? [];
    return list.map((c) => ({
      id: c.id,
      certificate_no: c.certificate_no,
      verification_code: c.verification_code,
      student: c.student?.full_name ?? c.student?.email ?? '—',
      credential: c.micro_credential?.title ?? '—',
      cohort: c.cohort?.title ?? '—',
      issued: c.issued_at ? new Date(c.issued_at).toLocaleString(locale) : '—',
      status: c.status,
    }));
  }, [data, locale]);

  const issuedCount = useMemo(() => (data?.certificates ?? []).filter((c) => c.status === 'issued').length, [data]);

  const emptyTitle = isError ? tCommon('errors.generic') : rows.length ? t('list.emptyTitle') : t('list.emptyTitle');
  const emptyDescription = isError ? getApiErrorMessage(error, t('list.loadError')) : t('list.emptyDescription');

  const canWrite = canWriteCertificate(user);

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader title={t('list.title')} description={t('list.description')} />
      <AdminActionBar>
        {canWrite ? (
          <Link className="btn btn--primary" to="/admin/certificates/issue">
            {t('list.issue')}
          </Link>
        ) : null}
        <button
          type="button"
          className="btn btn--outline"
          onClick={() => {
            const code = typeof window !== 'undefined' ? window.prompt(t('verify.prompt')) : '';
            if (code && String(code).trim()) {
              navigate(`/verify/certificate/${encodeURIComponent(String(code).trim())}`);
            }
          }}
        >
          {t('list.verifyLink')}
        </button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('list.searchPlaceholder')}
          aria-label={tCommon('actions.search')}
        />
        <SelectField id="cert-status" label={t('list.status')} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('list.allStatuses')}</option>
          <option value="issued">{t('statuses.issued')}</option>
          <option value="revoked">{t('statuses.revoked')}</option>
          <option value="superseded">{t('statuses.superseded')}</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={t('list.stats.issued')} value={String(issuedCount)} icon={Award} />
        <StatCard label={t('list.stats.total')} value={String(rows.length)} icon={Award} />
      </AdminStatsGrid>
      <SectionCard title={t('list.title')}>
        {isLoading ? <p className="crud-muted">{tCommon('loading')}</p> : null}
        <DataTable
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          columns={[
            { key: 'certificate_no', label: t('list.columns.certificateNo') },
            { key: 'verification_code', label: t('list.columns.verificationCode') },
            { key: 'student', label: t('list.columns.student') },
            { key: 'credential', label: t('list.columns.microCredential') },
            { key: 'cohort', label: t('list.columns.cohort') },
            { key: 'issued', label: t('list.columns.issuedAt') },
            {
              key: 'status',
              label: t('list.columns.status'),
              render: (r) => <StatusBadge variant={genericStatusVariant(r.status)}>{statusLabelAr(r.status, locale)}</StatusBadge>,
            },
            {
              key: 'actions',
              label: t('list.columns.actions'),
              render: (r) => <TableIconActions viewTo={`/admin/certificates/${r.id}`} />,
            },
          ]}
          rows={isError ? [] : rows}
        />
      </SectionCard>
    </div>
  );
}
