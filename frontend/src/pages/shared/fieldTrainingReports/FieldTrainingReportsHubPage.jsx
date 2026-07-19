import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { BarChart3, Briefcase, ClipboardList, FileText, Users, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { AdminStatsGrid } from '../../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { StatCard } from '../../../components/common/StatCard.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { TableIconActions } from '../../../components/crud/TableIconActions.jsx';
import { UnauthorizedPage } from '../../../components/permissions/UnauthorizedPage.jsx';
import { useTenant } from '../../../features/tenant/index.js';
import { useAuth } from '../../../features/auth/index.js';
import { ROLES } from '../../../constants/roles.js';
import { useFieldTrainingDashboard } from '../../../features/fieldTrainingReports/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { resolveReportParams } from './FieldTrainingReportFilters.jsx';

export function FieldTrainingReportsHubPage({ basePath, mode = 'admin' }) {
  const { t } = useTranslation('fieldTrainingReports');
  const { t: tCommon } = useTranslation('common');
  const { user } = useAuth();
  const { scopeId, isAllTenantsSelected } = useTenant();
  const params = useMemo(
    () => resolveReportParams({}, { mode, user, scopeId, isAllTenantsSelected }),
    [mode, user, scopeId, isAllTenantsSelected]
  );
  const studentsPath = mode === 'academic' ? '/academic/field-training/students' : `${basePath}/students`;
  const studentDetailPrefix = mode === 'academic' ? '/academic/field-training/reports/student' : `${basePath}/student`;
  const canGlobal = mode === 'admin' && [ROLES.SUPER_ADMIN].includes(user?.role);

  const { data, isLoading, isError, error } = useFieldTrainingDashboard(params, {
    enabled: Boolean(params.university_id),
    staleTime: 30_000,
    mode,
  });

  const summary = data?.summary ?? {};
  const recent = data?.recent_applications ?? [];

  if (isError && error?.response?.status === 403) {
    return <UnauthorizedPage title={t('global.forbiddenTitle')} description={t('global.forbiddenDescription')} />;
  }

  return (
    <div className="page page--dashboard page--field-training-reports">
      <AdminPageHeader
        title={t('hub.title')}
        description={t('hub.description')}
        actions={
          <div className="ft-report-hub__actions">
            {canGlobal ? (
              <Link className="btn btn--outline btn--sm" to={`${basePath}/global`}>
                <Globe size={16} aria-hidden />
                {t('hub.globalReportLink')}
              </Link>
            ) : null}
            <Link className="btn btn--outline btn--sm" to={studentsPath}>
              {t('hub.applicationsLink')}
            </Link>
            <Link className="btn btn--primary btn--sm" to={`${basePath}/university`}>
              {t('hub.universityReportLink')}
            </Link>
          </div>
        }
      />

      {!params.university_id ? (
        <p className="crud-muted" role="status">
          {tCommon('tenant.select')}
        </p>
      ) : null}

      {params.university_id && isLoading ? <LoadingSpinner /> : null}
      {params.university_id && isError ? (
        <p className="crud-muted">{getApiErrorMessage(error, tCommon('errors.generic'))}</p>
      ) : null}

      {params.university_id && !isLoading && !isError ? (
        <>
          <AdminStatsGrid>
            <StatCard label={t('metrics.eligibleOpportunities')} value={String(summary.eligible_opportunities ?? 0)} icon={Briefcase} />
            <StatCard label={t('metrics.totalApplicants')} value={String(summary.total_applicants ?? 0)} icon={Users} />
            <StatCard label={t('metrics.inTraining')} value={String(summary.in_training_students ?? 0)} icon={ClipboardList} />
            <StatCard label={t('metrics.completed')} value={String(summary.completed_students ?? 0)} icon={BarChart3} />
            <StatCard label={t('metrics.completionLetters')} value={String(summary.completion_letters_issued ?? 0)} icon={FileText} />
            <StatCard
              label={t('metrics.averageAttendance')}
              value={summary.average_attendance != null ? `${summary.average_attendance}%` : '—'}
              icon={BarChart3}
            />
          </AdminStatsGrid>

          <SectionCard title={t('hub.recentApplications')}>
            <DataTable
              emptyTitle={t('hub.noApplications')}
              columns={[
                { key: 'student_name', label: t('table.student') },
                { key: 'opportunity_title', label: t('table.opportunity') },
                { key: 'status', label: t('table.applicationStatus') },
                { key: 'training_status', label: t('table.trainingStatus') },
                {
                  key: 'actions',
                  label: t('table.actions'),
                  render: (row) => (
                    <TableIconActions viewTo={`${studentDetailPrefix}/${row.id ?? row.application_id}`} />
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