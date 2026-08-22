import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import {
  BarChart3,
  Briefcase,
  ClipboardList,
  FileText,
  Users,
  Globe,
  CheckCircle2,
  XCircle,
  Hourglass,
  Award,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { ContextualHelpButton } from '../../../components/help/ContextualHelpButton.jsx';
import { AdminStatsGrid } from '../../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { StatCard } from '../../../components/common/StatCard.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { TableIconActions } from '../../../components/crud/TableIconActions.jsx';
import { UnauthorizedPage } from '../../../components/permissions/UnauthorizedPage.jsx';
import { useTenant } from '../../../features/tenant/index.js';
import { useAuth, resolveAuthUniversityId } from '../../../features/auth/index.js';
import { ROLES } from '../../../constants/roles.js';
import {
  useFieldTrainingDashboard,
  useFieldTrainingOpportunities,
} from '../../../features/fieldTrainingReports/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { resolveReportParams, FieldTrainingReportFilters } from './FieldTrainingReportFilters.jsx';
import { FieldTrainingReportRoleBanner } from './FieldTrainingReportRoleBanner.jsx';
import { getReportPaths, mergeReportCapabilities, usesAcademicReportApi } from './reportCapabilities.js';
import { formatFtDate } from '../../../features/fieldTraining/fieldTrainingUi.js';

function MetricLink({ to, children }) {
  return (
    <Link to={to} className="ft-report-metric-link">
      {children}
    </Link>
  );
}

export function FieldTrainingReportsHubPage({ basePath, mode = 'admin' }) {
  const { t } = useTranslation('fieldTrainingReports');
  const { t: tCommon } = useTranslation('common');
  const { user } = useAuth();
  const { scopeId, isAllTenantsSelected } = useTenant();
  const [filters, setFilters] = useState({});
  const params = useMemo(
    () => resolveReportParams(filters, { mode, user, scopeId, isAllTenantsSelected }),
    [filters, mode, user, scopeId, isAllTenantsSelected]
  );
  const paths = getReportPaths(basePath, mode);
  const canGlobal = mode === 'admin' && [ROLES.SUPER_ADMIN].includes(user?.role);
  const universityMissing = usesAcademicReportApi(mode) && !resolveAuthUniversityId(user);
  const universityName = user?.university?.name || user?.primary_university?.name || '';

  const { data, isLoading, isError, error, refetch, isFetching } = useFieldTrainingDashboard(params, {
    enabled: Boolean(params.university_id),
    staleTime: 30_000,
    mode,
  });

  const { data: opportunitiesData } = useFieldTrainingOpportunities(params, {
    enabled: usesAcademicReportApi(mode) && Boolean(params.university_id),
    staleTime: 30_000,
    mode,
  });

  const capabilities = mergeReportCapabilities(data?.capabilities, user, mode);
  const summary = data?.summary ?? {};
  const recent = data?.recent_applications ?? [];
  const opportunities = opportunitiesData?.opportunities ?? [];

  if (universityMissing) {
    return (
      <div className="page page--dashboard page--field-training-reports">
        <AdminPageHeader title={t('hub.title')} description={t('hub.description')} />
        <SectionCard title={t('hub.universityRequiredTitle')}>
          <p className="crud-muted" role="alert">
            {t('hub.universityRequired')}
          </p>
        </SectionCard>
      </div>
    );
  }

  if (isError && error?.response?.status === 403) {
    return (
      <UnauthorizedPage title={t('global.forbiddenTitle')} description={t('global.forbiddenDescription')} />
    );
  }

  return (
    <div className="page page--dashboard page--field-training-reports">
      <AdminPageHeader
        title={t('hub.title')}
        description={
          data?.university?.name || universityName
            ? `${t('hub.description')} — ${data?.university?.name || universityName}`
            : t('hub.description')
        }
        actions={
          <div className="ft-report-hub__actions">
            <ContextualHelpButton contextualKey="progress" route={basePath} />
            {canGlobal ? (
              <Link className="btn btn--outline btn--sm" to={`${basePath}/global`}>
                <Globe size={16} aria-hidden />
                {t('hub.globalReportLink')}
              </Link>
            ) : null}
            {usesAcademicReportApi(mode) ? (
              <Link className="btn btn--outline btn--sm" to={paths.opportunities}>
                <Briefcase size={16} aria-hidden />
                {t('hub.opportunitiesLink')}
              </Link>
            ) : null}
            <Link className="btn btn--outline btn--sm" to={paths.students}>
              {t('hub.applicationsLink')}
            </Link>
            <Link className="btn btn--primary btn--sm" to={paths.university}>
              {t('hub.universityReportLink')}
            </Link>
          </div>
        }
      />

      <FieldTrainingReportRoleBanner user={user} mode={mode} capabilities={capabilities} />
      {capabilities.canSelectUniversity ? (
        <FieldTrainingReportFilters value={filters} onChange={setFilters} mode={mode} />
      ) : null}

      {!params.university_id ? (
        <p className="crud-muted" role="status">
          {tCommon('tenant.select')}
        </p>
      ) : null}

      {params.university_id && isLoading ? <LoadingSpinner /> : null}
      {params.university_id && isError ? (
        <div className="ft-report-error" role="alert">
          <p className="crud-muted">{getApiErrorMessage(error, tCommon('errors.generic'))}</p>
          <button type="button" className="btn btn--outline btn--sm" onClick={() => refetch()}>
            {tCommon('actions.retry', { defaultValue: 'إعادة المحاولة' })}
          </button>
        </div>
      ) : null}

      {params.university_id && !isLoading && !isError ? (
        <>
          <AdminStatsGrid>
            <MetricLink to={paths.opportunities}>
              <StatCard
                label={t('metrics.eligibleOpportunities')}
                value={String(summary.eligible_opportunities ?? 0)}
                icon={Briefcase}
              />
            </MetricLink>
            <MetricLink to={paths.students}>
              <StatCard
                label={t('metrics.totalApplicants')}
                value={String(summary.total_applicants ?? 0)}
                icon={Users}
              />
            </MetricLink>
            <MetricLink to={`${paths.students}?status=pending`}>
              <StatCard
                label={t('metrics.pendingReview')}
                value={String(summary.pending_review ?? 0)}
                icon={Hourglass}
              />
            </MetricLink>
            <MetricLink to={`${paths.students}?status=approved`}>
              <StatCard
                label={t('metrics.accepted')}
                value={String(summary.accepted_students ?? 0)}
                icon={CheckCircle2}
              />
            </MetricLink>
            <MetricLink to={`${paths.students}?training_status=in_training`}>
              <StatCard
                label={t('metrics.inTraining')}
                value={String(summary.in_training_students ?? 0)}
                icon={ClipboardList}
              />
            </MetricLink>
            <MetricLink to={`${paths.students}?training_status=completed`}>
              <StatCard
                label={t('metrics.completed')}
                value={String(summary.completed_students ?? 0)}
                icon={BarChart3}
              />
            </MetricLink>
            <MetricLink to={`${paths.students}?training_status=expelled`}>
              <StatCard
                label={t('metrics.expelled')}
                value={String(summary.expelled_students ?? 0)}
                icon={XCircle}
              />
            </MetricLink>
            <MetricLink to={`${paths.students}?eligibility_status=eligible`}>
              <StatCard
                label={t('metrics.eligibleStudents')}
                value={String(summary.eligible_students ?? 0)}
                icon={Award}
              />
            </MetricLink>
            <StatCard
              label={t('metrics.completionLetters')}
              value={String(summary.completion_letters_issued ?? 0)}
              icon={FileText}
            />
            <StatCard
              label={t('metrics.averageAttendance')}
              value={summary.average_attendance != null ? `${summary.average_attendance}%` : '—'}
              icon={BarChart3}
            />
            <StatCard
              label={t('metrics.averagePreAssessment')}
              value={
                summary.average_pre_assessment_score != null
                  ? String(summary.average_pre_assessment_score)
                  : '—'
              }
              icon={BarChart3}
            />
            <StatCard
              label={t('metrics.averagePostAssessment')}
              value={
                summary.average_post_assessment_score != null
                  ? String(summary.average_post_assessment_score)
                  : '—'
              }
              icon={BarChart3}
            />
            <StatCard
              label={t('metrics.tasksSubmitted')}
              value={String(summary.tasks_submitted ?? 0)}
              icon={ClipboardList}
            />
          </AdminStatsGrid>

          {capabilities.readOnly && (summary.total_applicants ?? 0) === 0 ? (
            <p className="crud-muted" role="status">
              {t('states.emptyReviewer')}
            </p>
          ) : null}

          <SectionCard title={t('hub.reportsTitle')}>
            <div className="ft-report-hub-cards">
              <Link className="ft-report-hub-card" to={paths.university}>
                <h3>{t('hub.universityReportLink')}</h3>
                <p>{t('universityReport.description')}</p>
              </Link>
              <Link className="ft-report-hub-card" to={paths.students}>
                <h3>{t('hub.studentReportsLink')}</h3>
                <p>{t('applications.description')}</p>
              </Link>
              <Link className="ft-report-hub-card" to={paths.university}>
                <h3>{t('hub.attendanceReportLink')}</h3>
                <p>{t('universityReport.description')}</p>
              </Link>
              <Link className="ft-report-hub-card" to={paths.university}>
                <h3>{t('hub.hoursReportLink')}</h3>
                <p>{t('universityReport.description')}</p>
              </Link>
              <Link className="ft-report-hub-card" to={paths.university}>
                <h3>{t('hub.progressReportLink')}</h3>
                <p>{t('universityReport.description')}</p>
              </Link>
              <Link className="ft-report-hub-card" to={paths.university}>
                <h3>{t('hub.assessmentsReportLink')}</h3>
                <p>{t('universityReport.description')}</p>
              </Link>
              <Link className="ft-report-hub-card" to={paths.university}>
                <h3>{t('hub.certificatesReportLink')}</h3>
                <p>{t('universityReport.description')}</p>
              </Link>
            </div>
          </SectionCard>

          {usesAcademicReportApi(mode) ? (
            <SectionCard
              title={t('hub.opportunitiesTitle')}
              actions={
                <Link className="btn btn--ghost btn--sm" to={paths.opportunities}>
                  {t('hub.viewAll')}
                </Link>
              }
            >
              {opportunities.length === 0 ? (
                <p className="crud-muted">{t('hub.noOpportunities')}</p>
              ) : (
                <div className="ft-report-opportunity-grid">
                  {opportunities.slice(0, 4).map((opp) => (
                    <Link
                      key={opp.id}
                      to={paths.opportunityDetail(opp.id)}
                      className="ft-report-opportunity-card"
                    >
                      <h3 className="ft-report-opportunity-card__title">{opp.title}</h3>
                      <p className="ft-report-opportunity-card__meta">
                        {opp.training_track?.name_ar || opp.training_track?.name_en || '—'}
                      </p>
                      <dl className="ft-report-opportunity-card__stats">
                        <div>
                          <dt>{t('opportunity.applicants')}</dt>
                          <dd>{opp.applicants_count ?? 0}</dd>
                        </div>
                        <div>
                          <dt>{t('metrics.inTraining')}</dt>
                          <dd>{opp.in_training_count ?? 0}</dd>
                        </div>
                        <div>
                          <dt>{t('metrics.completed')}</dt>
                          <dd>{opp.completed_count ?? 0}</dd>
                        </div>
                      </dl>
                    </Link>
                  ))}
                </div>
              )}
            </SectionCard>
          ) : null}

          <SectionCard
            title={t('hub.recentApplications')}
            actions={
              isFetching ? <span className="crud-muted">{tCommon('loading', { defaultValue: '…' })}</span> : null
            }
          >
            <DataTable
              emptyTitle={capabilities.readOnly ? t('states.emptyReviewer') : t('hub.noApplications')}
              columns={[
                { key: 'student_name', label: t('table.student') },
                { key: 'opportunity_title', label: t('table.opportunity') },
                { key: 'status', label: t('table.applicationStatus') },
                { key: 'training_status', label: t('table.trainingStatus') },
                {
                  key: 'created_at',
                  label: t('table.date'),
                  render: (row) => formatFtDate(row.created_at),
                },
                {
                  key: 'actions',
                  label: t('table.actions'),
                  render: (row) => (
                    <TableIconActions viewTo={`${paths.student}/${row.id ?? row.application_id}`} />
                  ),
                },
              ]}
              rows={recent}
            />
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
