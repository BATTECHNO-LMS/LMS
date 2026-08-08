import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { AdminStatsGrid } from '../../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { StatCard } from '../../../components/common/StatCard.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { TableIconActions } from '../../../components/crud/TableIconActions.jsx';
import { UnauthorizedPage } from '../../../components/permissions/UnauthorizedPage.jsx';
import { useAuth } from '../../../features/auth/index.js';
import { useTenant } from '../../../features/tenant/index.js';
import { useFieldTrainingOpportunityDetail } from '../../../features/fieldTrainingReports/index.js';
import { resolveReportParams } from './FieldTrainingReportFilters.jsx';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { formatFtDate } from '../../../features/fieldTraining/fieldTrainingUi.js';
import { Users, ClipboardList, CheckCircle2, BarChart3 } from 'lucide-react';

export function FieldTrainingOpportunityDetailReportPage({ mode = 'academic' }) {
  const { opportunityId } = useParams();
  const { t } = useTranslation('fieldTrainingReports');
  const { t: tCommon } = useTranslation('common');
  const { user } = useAuth();
  const { scopeId, isAllTenantsSelected } = useTenant();
  const params = useMemo(
    () => resolveReportParams({}, { mode, user, scopeId, isAllTenantsSelected }),
    [mode, user, scopeId, isAllTenantsSelected]
  );

  const { data, isLoading, isError, error, refetch } = useFieldTrainingOpportunityDetail(
    opportunityId,
    params,
    {
      enabled: Boolean(opportunityId) && Boolean(params.university_id),
      mode: 'academic',
    }
  );

  const opp = data?.opportunity;
  const students = data?.students ?? [];

  if (isError && error?.response?.status === 403) {
    return (
      <UnauthorizedPage title={t('global.forbiddenTitle')} description={t('global.forbiddenDescription')} />
    );
  }

  return (
    <div className="page page--field-training-reports">
      <AdminPageHeader
        title={opp?.title || t('opportunities.detailTitle')}
        description={t('opportunities.detailDescription')}
        actions={
          <div className="ft-report-hub__actions">
            <Link className="btn btn--ghost btn--sm" to="/academic/field-training/opportunities">
              {t('opportunities.backToList')}
            </Link>
            <Link
              className="btn btn--outline btn--sm"
              to={`/academic/field-training/students?opportunity_id=${opportunityId}`}
            >
              {t('hub.applicationsLink')}
            </Link>
          </div>
        }
      />

      {isLoading ? <LoadingSpinner /> : null}
      {isError && error?.response?.status !== 403 ? (
        <div className="ft-report-error" role="alert">
          <p className="crud-muted">{getApiErrorMessage(error, tCommon('errors.generic'))}</p>
          <button type="button" className="btn btn--outline btn--sm" onClick={() => refetch()}>
            {tCommon('actions.retry', { defaultValue: 'إعادة المحاولة' })}
          </button>
        </div>
      ) : null}

      {opp && !isLoading ? (
        <>
          <SectionCard title={t('sections.opportunity')}>
            <dl className="ft-report-detail-grid">
              <div className="ft-report-detail-grid__item">
                <dt>{t('opportunity.track')}</dt>
                <dd>{opp.training_track?.name_ar || opp.training_track?.name_en || '—'}</dd>
              </div>
              <div className="ft-report-detail-grid__item">
                <dt>{t('opportunity.instructor')}</dt>
                <dd>{opp.assigned_instructor?.full_name || '—'}</dd>
              </div>
              <div className="ft-report-detail-grid__item">
                <dt>{t('opportunity.mode')}</dt>
                <dd>{opp.training_mode || '—'}</dd>
              </div>
              <div className="ft-report-detail-grid__item">
                <dt>{t('opportunity.dates')}</dt>
                <dd>
                  {formatFtDate(opp.start_date)} — {formatFtDate(opp.end_date)}
                </dd>
              </div>
              <div className="ft-report-detail-grid__item">
                <dt>{t('opportunity.specialties')}</dt>
                <dd>
                  {(opp.eligible_specialties || []).map((s) => s.label).filter(Boolean).join('، ') || '—'}
                </dd>
              </div>
            </dl>
          </SectionCard>

          <AdminStatsGrid>
            <StatCard label={t('opportunity.applicants')} value={String(opp.applicants_count ?? 0)} icon={Users} />
            <StatCard label={t('metrics.accepted')} value={String(opp.accepted_count ?? 0)} icon={CheckCircle2} />
            <StatCard
              label={t('metrics.inTraining')}
              value={String(opp.in_training_count ?? 0)}
              icon={ClipboardList}
            />
            <StatCard label={t('metrics.completed')} value={String(opp.completed_count ?? 0)} icon={BarChart3} />
          </AdminStatsGrid>

          <SectionCard title={t('opportunities.universityStudentsOnly')}>
            <DataTable
              emptyTitle={t('hub.noApplications')}
              columns={[
                { key: 'student_name', label: t('table.student') },
                { key: 'university_specialty_label', label: t('table.specialty') },
                { key: 'application_status', label: t('table.applicationStatus') },
                { key: 'training_status', label: t('table.trainingStatus') },
                { key: 'attendance_percentage', label: t('table.attendance') },
                { key: 'eligibility_status', label: t('table.eligibility') },
                {
                  key: 'actions',
                  label: t('table.actions'),
                  render: (row) => (
                    <TableIconActions
                      viewTo={`/academic/field-training/reports/student/${row.application_id}`}
                    />
                  ),
                },
              ]}
              rows={students}
            />
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
