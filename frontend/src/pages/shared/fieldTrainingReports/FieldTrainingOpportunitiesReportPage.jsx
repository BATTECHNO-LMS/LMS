import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { useAuth, resolveAuthUniversityId } from '../../../features/auth/index.js';
import { useTenant } from '../../../features/tenant/index.js';
import { useFieldTrainingOpportunities } from '../../../features/fieldTrainingReports/index.js';
import { resolveReportParams } from './FieldTrainingReportFilters.jsx';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { formatFtDate } from '../../../features/fieldTraining/fieldTrainingUi.js';

export function FieldTrainingOpportunitiesReportPage({ mode = 'academic' }) {
  const { t } = useTranslation('fieldTrainingReports');
  const { t: tCommon } = useTranslation('common');
  const { user } = useAuth();
  const { scopeId, isAllTenantsSelected } = useTenant();
  const params = useMemo(
    () => resolveReportParams({}, { mode, user, scopeId, isAllTenantsSelected }),
    [mode, user, scopeId, isAllTenantsSelected]
  );

  const universityMissing = !resolveAuthUniversityId(user);
  const { data, isLoading, isError, error, refetch } = useFieldTrainingOpportunities(params, {
    enabled: Boolean(params.university_id),
    mode: 'academic',
  });

  const opportunities = data?.opportunities ?? [];

  if (universityMissing) {
    return (
      <div className="page page--field-training-reports">
        <AdminPageHeader title={t('opportunities.title')} description={t('opportunities.description')} />
        <SectionCard title={t('hub.universityRequiredTitle')}>
          <p className="crud-muted" role="alert">
            {t('hub.universityRequired')}
          </p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="page page--field-training-reports">
      <AdminPageHeader
        title={t('opportunities.title')}
        description={
          data?.university?.name
            ? `${t('opportunities.description')} — ${data.university.name}`
            : t('opportunities.description')
        }
        actions={
          <Link className="btn btn--ghost btn--sm" to="/academic/field-training/reports">
            {t('common.backToHub')}
          </Link>
        }
      />

      {isLoading ? <LoadingSpinner /> : null}
      {isError ? (
        <div className="ft-report-error" role="alert">
          <p className="crud-muted">{getApiErrorMessage(error, tCommon('errors.generic'))}</p>
          <button type="button" className="btn btn--outline btn--sm" onClick={() => refetch()}>
            {tCommon('actions.retry', { defaultValue: 'إعادة المحاولة' })}
          </button>
        </div>
      ) : null}

      {!isLoading && !isError ? (
        <SectionCard title={t('opportunities.listTitle')}>
          {opportunities.length === 0 ? (
            <p className="crud-muted">{t('hub.noOpportunities')}</p>
          ) : (
            <div className="ft-report-opportunity-grid ft-report-opportunity-grid--full">
              {opportunities.map((opp) => (
                <Link
                  key={opp.id}
                  to={`/academic/field-training/opportunities/${opp.id}`}
                  className="ft-report-opportunity-card"
                >
                  <div className="ft-report-opportunity-card__top">
                    <h3 className="ft-report-opportunity-card__title">{opp.title}</h3>
                    <span className={`ft-status-badge ft-status-badge--${opp.status || 'unknown'}`}>
                      {opp.status || '—'}
                    </span>
                  </div>
                  <p className="ft-report-opportunity-card__meta">
                    {opp.training_track?.name_ar || opp.training_track?.name_en || '—'}
                  </p>
                  <p className="ft-report-opportunity-card__meta">
                    {t('opportunity.instructor')}: {opp.assigned_instructor?.full_name || '—'}
                  </p>
                  <p className="ft-report-opportunity-card__meta">
                    {t('opportunity.mode')}: {opp.training_mode || '—'} · {formatFtDate(opp.start_date)} —{' '}
                    {formatFtDate(opp.end_date)}
                  </p>
                  <p className="ft-report-opportunity-card__meta">
                    {t('opportunity.specialties')}:{' '}
                    {(opp.eligible_specialties || []).map((s) => s.label).filter(Boolean).join('، ') || '—'}
                  </p>
                  <dl className="ft-report-opportunity-card__stats">
                    <div>
                      <dt>{t('opportunity.applicants')}</dt>
                      <dd>{opp.applicants_count ?? 0}</dd>
                    </div>
                    <div>
                      <dt>{t('metrics.accepted')}</dt>
                      <dd>{opp.accepted_count ?? 0}</dd>
                    </div>
                    <div>
                      <dt>{t('metrics.inTraining')}</dt>
                      <dd>{opp.in_training_count ?? 0}</dd>
                    </div>
                    <div>
                      <dt>{t('metrics.completed')}</dt>
                      <dd>{opp.completed_count ?? 0}</dd>
                    </div>
                    <div>
                      <dt>{t('metrics.averageAttendance')}</dt>
                      <dd>
                        {opp.average_attendance != null ? `${opp.average_attendance}%` : '—'}
                      </dd>
                    </div>
                  </dl>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}
    </div>
  );
}
