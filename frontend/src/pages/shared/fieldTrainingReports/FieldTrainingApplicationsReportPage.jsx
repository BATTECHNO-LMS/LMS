import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { TableIconActions } from '../../../components/crud/TableIconActions.jsx';
import { useTenant } from '../../../features/tenant/index.js';
import { useAuth } from '../../../features/auth/index.js';
import { useFieldTrainingApplicationsReport } from '../../../features/fieldTrainingReports/index.js';
import { FieldTrainingReportFilters, resolveReportParams } from './FieldTrainingReportFilters.jsx';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

export function FieldTrainingApplicationsReportPage({ basePath, mode = 'admin' }) {
  const { t } = useTranslation('fieldTrainingReports');
  const { t: tCommon } = useTranslation('common');
  const { user } = useAuth();
  const { scopeId, isAllTenantsSelected } = useTenant();
  const [filters, setFilters] = useState({});
  const params = useMemo(
    () => resolveReportParams(filters, { mode, user, scopeId, isAllTenantsSelected }),
    [filters, mode, user, scopeId, isAllTenantsSelected]
  );

  const { data, isLoading, isError, error } = useFieldTrainingApplicationsReport(params, {
    enabled: Boolean(params.university_id),
    staleTime: 30_000,
    mode,
  });

  const students = data?.students ?? [];

  return (
    <div className="page page--field-training-reports">
      <AdminPageHeader
        title={t('applications.title')}
        description={t('applications.description')}
        actions={
          <Link className="btn btn--ghost btn--sm" to={basePath}>
            {t('common.backToHub')}
          </Link>
        }
      />

      {!params.university_id ? <p className="crud-muted">{tCommon('tenant.select')}</p> : null}
      <FieldTrainingReportFilters value={filters} onChange={setFilters} mode={mode} />
      {params.university_id && isLoading ? <LoadingSpinner /> : null}
      {params.university_id && isError ? (
        <p className="crud-muted">{getApiErrorMessage(error, tCommon('errors.generic'))}</p>
      ) : null}

      {params.university_id && !isLoading && !isError ? (
        <SectionCard title={data?.university?.name ?? t('applications.tableTitle')}>
          <DataTable
            emptyTitle={t('hub.noApplications')}
            columns={[
              { key: 'student_name', label: t('table.student') },
              { key: 'university_specialty_label', label: t('table.specialty') },
              { key: 'opportunity_title', label: t('table.opportunity') },
              { key: 'application_status', label: t('table.applicationStatus') },
              { key: 'training_status', label: t('table.trainingStatus') },
              { key: 'attendance_percentage', label: t('table.attendance') },
              { key: 'required_training_hours', label: t('table.requiredHours') },
              { key: 'completed_training_hours', label: t('table.completedHours') },
              { key: 'hours_completion_percentage', label: t('table.hoursPercentage') },
              { key: 'hours_completion_status_label', label: t('table.hoursStatus') },
              { key: 'pre_assessment_score', label: t('table.preAssessment') },
              { key: 'post_assessment_score', label: t('table.postAssessment') },
              { key: 'eligibility_status', label: t('table.eligibility') },
              {
                key: 'actions',
                label: t('table.actions'),
                render: (row) => (
                    <TableIconActions viewTo={`${basePath}/student/${row.application_id}`} />
                ),
              },
            ]}
            rows={students}
          />
        </SectionCard>
      ) : null}
    </div>
  );
}
