import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { useRiskCase } from '../../../features/risks/index.js';
import { usePortalPathPrefix } from '../../../utils/portalPathPrefix.js';

export function RiskCaseViewPage() {
  const { id } = useParams();
  const base = usePortalPathPrefix();
  const { t } = useTranslation('riskCases');
  const { t: tCommon } = useTranslation('common');
  const { data, isLoading, isError, error } = useRiskCase(id, { staleTime: 30_000 });
  const row = data?.risk_case;

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
            <dt>{t('table.student')}</dt>
            <dd>{row.student?.full_name ?? '—'}</dd>
            <dt>{t('table.cohort')}</dt>
            <dd>{row.cohort?.title ?? '—'}</dd>
            <dt>{t('table.type')}</dt>
            <dd>{row.risk_type}</dd>
            <dt>{t('table.level')}</dt>
            <dd>{row.risk_level}</dd>
            <dt>{t('table.status')}</dt>
            <dd>{row.status}</dd>
            <dt>{t('form.actionPlan')}</dt>
            <dd>{row.action_plan ?? '—'}</dd>
          </dl>
        ) : null}
        <div className="form-actions" style={{ marginTop: '1rem' }}>
          <Link className="btn btn--outline" to={`${base}/risk-cases`}>
            {t('detail.back')}
          </Link>
          {row ? (
            <Link className="btn btn--primary" to={`${base}/risk-cases/${row.id}/edit`}>
              {tCommon('actions.edit')}
            </Link>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}
