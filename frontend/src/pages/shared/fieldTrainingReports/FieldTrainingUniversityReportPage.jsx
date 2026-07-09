import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileDown, FileSpreadsheet } from 'lucide-react';
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
import {
  exportFieldTrainingUniversityReport,
  useFieldTrainingUniversityReport,
} from '../../../features/fieldTrainingReports/index.js';
import { FieldTrainingReportFilters, resolveReportParams } from './FieldTrainingReportFilters.jsx';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

export function FieldTrainingUniversityReportPage({ basePath, mode = 'admin' }) {
  const { t } = useTranslation('fieldTrainingReports');
  const { t: tCommon } = useTranslation('common');
  const { user } = useAuth();
  const { scopeId, isAllTenantsSelected } = useTenant();
  const [filters, setFilters] = useState({});
  const [exporting, setExporting] = useState(null);
  const params = useMemo(
    () => resolveReportParams(filters, { mode, user, scopeId, isAllTenantsSelected }),
    [filters, mode, user, scopeId, isAllTenantsSelected]
  );

  const { data, isLoading, isError, error } = useFieldTrainingUniversityReport(params, {
    enabled: Boolean(params.university_id),
    staleTime: 30_000,
    mode,
  });

  const summary = data?.summary ?? {};
  const bySpecialty = data?.by_specialty ?? [];
  const students = data?.students ?? [];

  async function handleExport(format) {
    if (!params.university_id) return;
    setExporting(format);
    try {
      await exportFieldTrainingUniversityReport(format, params, mode);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="page page--field-training-reports">
      <AdminPageHeader
        title={t('universityReport.title')}
        description={t('universityReport.description')}
        actions={
          <div className="ft-report-hub__actions">
            <Link className="btn btn--ghost btn--sm" to={basePath}>
              {t('common.backToHub')}
            </Link>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              disabled={!params.university_id || exporting === 'pdf'}
              onClick={() => handleExport('pdf')}
            >
              <FileDown size={16} aria-hidden />
              {t('export.pdf')}
            </button>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              disabled={!params.university_id || exporting === 'xlsx'}
              onClick={() => handleExport('xlsx')}
            >
              <FileSpreadsheet size={16} aria-hidden />
              {t('export.excel')}
            </button>
          </div>
        }
      />

      <FieldTrainingReportFilters value={filters} onChange={setFilters} mode={mode} />

      {!params.university_id ? <p className="crud-muted">{tCommon('tenant.select')}</p> : null}
      {params.university_id && isLoading ? <LoadingSpinner /> : null}
      {params.university_id && isError && error?.response?.status === 403 ? (
        <UnauthorizedPage title={t('global.forbiddenTitle')} description={t('global.forbiddenDescription')} />
      ) : null}
      {params.university_id && isError && error?.response?.status !== 403 ? (
        <p className="crud-muted">{getApiErrorMessage(error, tCommon('errors.generic'))}</p>
      ) : null}

      {params.university_id && !isLoading && !isError ? (
        <>
          <p className="ft-report-subtitle">
            {data?.university?.name ?? '—'}
          </p>

          <AdminStatsGrid>
            <StatCard label={t('metrics.eligibleOpportunities')} value={String(summary.eligible_opportunities ?? 0)} />
            <StatCard label={t('metrics.totalApplicants')} value={String(summary.total_applicants ?? 0)} />
            <StatCard label={t('metrics.accepted')} value={String(summary.accepted_students ?? 0)} />
            <StatCard label={t('metrics.rejected')} value={String(summary.rejected_students ?? 0)} />
            <StatCard label={t('metrics.expelled')} value={String(summary.expelled_students ?? 0)} />
            <StatCard label={t('metrics.inTraining')} value={String(summary.in_training_students ?? 0)} />
            <StatCard label={t('metrics.completed')} value={String(summary.completed_students ?? 0)} />
            <StatCard label={t('metrics.completionLetters')} value={String(summary.completion_letters_issued ?? 0)} />
            <StatCard
              label={t('metrics.averageAttendance')}
              value={summary.average_attendance != null ? `${summary.average_attendance}%` : '—'}
            />
            <StatCard
              label={t('metrics.averagePreAssessment')}
              value={summary.average_pre_assessment_score != null ? String(summary.average_pre_assessment_score) : '—'}
            />
            <StatCard
              label={t('metrics.averagePostAssessment')}
              value={summary.average_post_assessment_score != null ? String(summary.average_post_assessment_score) : '—'}
            />
            <StatCard
              label={t('metrics.taskSubmissionRate')}
              value={summary.task_submission_rate != null ? `${summary.task_submission_rate}%` : '—'}
            />
          </AdminStatsGrid>

          <SectionCard title={t('universityReport.bySpecialty')}>
            <DataTable
              columns={[
                { key: 'label', label: t('table.specialty') },
                { key: 'applicants_count', label: t('table.applicants') },
                { key: 'accepted_count', label: t('table.accepted') },
                { key: 'attendance_average', label: t('table.attendanceAvg') },
                { key: 'task_completion_rate', label: t('table.taskCompletionRate') },
                { key: 'post_assessment_average', label: t('table.postAssessmentAvg') },
                { key: 'completion_count', label: t('table.completed') },
              ]}
              rows={bySpecialty}
            />
          </SectionCard>

          <SectionCard title={t('universityReport.studentsTable')}>
            <DataTable
              columns={[
                { key: 'student_name', label: t('table.student') },
                { key: 'university_specialty_label', label: t('table.specialty') },
                { key: 'opportunity_title', label: t('table.opportunity') },
                { key: 'application_status', label: t('table.applicationStatus') },
                { key: 'training_status', label: t('table.trainingStatus') },
                { key: 'attendance_percentage', label: t('table.attendance') },
                { key: 'pre_assessment_score', label: t('table.preAssessment') },
                { key: 'post_assessment_score', label: t('table.postAssessment') },
                { key: 'final_task_status', label: t('table.finalTask') },
                { key: 'eligibility_status', label: t('table.eligibility') },
                { key: 'completion_letter_status', label: t('table.completionLetter') },
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
        </>
      ) : null}
    </div>
  );
}
