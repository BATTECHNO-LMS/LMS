import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileDown, FileSpreadsheet, Printer, RefreshCw } from 'lucide-react';
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
  generateFieldTrainingUniversityReport,
  regenerateFieldTrainingUniversityReport,
  useFieldTrainingUniversityReport,
} from '../../../features/fieldTrainingReports/index.js';
import { FieldTrainingReportFilters, resolveReportParams } from './FieldTrainingReportFilters.jsx';
import { FieldTrainingReportCharts, displayReportValue } from './FieldTrainingReportCharts.jsx';
import { FieldTrainingReportRoleBanner } from './FieldTrainingReportRoleBanner.jsx';
import { getReportPaths, mergeReportCapabilities } from './reportCapabilities.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

export function FieldTrainingUniversityReportPage({ basePath, mode = 'admin' }) {
  const { t } = useTranslation('fieldTrainingReports');
  const { t: tCommon } = useTranslation('common');
  const { user } = useAuth();
  const { scopeId, isAllTenantsSelected } = useTenant();
  const [filters, setFilters] = useState({});
  const [exporting, setExporting] = useState(null);
  const [actionError, setActionError] = useState(null);
  const params = useMemo(
    () => resolveReportParams(filters, { mode, user, scopeId, isAllTenantsSelected }),
    [filters, mode, user, scopeId, isAllTenantsSelected]
  );
  const paths = getReportPaths(basePath, mode);

  const { data, isLoading, isError, error, refetch } = useFieldTrainingUniversityReport(params, {
    enabled: Boolean(params.university_id),
    staleTime: 30_000,
    mode,
  });

  const capabilities = mergeReportCapabilities(data?.capabilities, user, mode);
  const summary = data?.summary ?? {};
  const bySpecialty = data?.by_specialty ?? [];
  const students = data?.students ?? [];
  const stale = data?.meta?.status === 'STALE';

  async function handleExport(format) {
    if (!params.university_id || exporting) return;
    setExporting(format);
    setActionError(null);
    try {
      await exportFieldTrainingUniversityReport(format, params, mode);
    } catch (err) {
      setActionError(err);
    } finally {
      setExporting(null);
    }
  }

  async function handleGenerate(kind) {
    if (!params.university_id || exporting || !capabilities.canGenerate) return;
    setExporting(kind);
    setActionError(null);
    try {
      if (kind === 'regenerate') {
        await regenerateFieldTrainingUniversityReport(params, mode);
      } else {
        await generateFieldTrainingUniversityReport(params, mode);
      }
      await refetch();
    } catch (err) {
      setActionError(err);
    } finally {
      setExporting(null);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="page page--field-training-reports">
      <AdminPageHeader
        title={t('universityReport.title')}
        description={t('universityReport.description')}
        actions={
          <div className="ft-report-hub__actions">
            <Link className="btn btn--ghost btn--sm" to={paths.hub}>
              {t('common.backToHub')}
            </Link>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={!params.university_id}
              onClick={() => refetch()}
            >
              <RefreshCw size={16} aria-hidden />
              {capabilities.readOnly ? t('export.view') : t('export.refresh')}
            </button>
            {capabilities.canGenerate ? (
              <button
                type="button"
                className="btn btn--primary btn--sm"
                disabled={!params.university_id || Boolean(exporting)}
                onClick={() => handleGenerate('generate')}
              >
                {exporting === 'generate' ? t('export.generating') : t('export.generate')}
              </button>
            ) : null}
            {capabilities.canRegenerate ? (
              <button
                type="button"
                className="btn btn--outline btn--sm"
                disabled={!params.university_id || Boolean(exporting)}
                onClick={() => handleGenerate('regenerate')}
              >
                {exporting === 'regenerate' ? t('export.generating') : t('export.regenerate')}
              </button>
            ) : null}
            {capabilities.canExportPdf ? (
              <button
                type="button"
                className="btn btn--outline btn--sm"
                disabled={!params.university_id || Boolean(exporting)}
                onClick={() => handleExport('pdf')}
              >
                <FileDown size={16} aria-hidden />
                {exporting === 'pdf' ? t('export.generating') : t('export.pdf')}
              </button>
            ) : null}
            {capabilities.canExportExcel ? (
              <button
                type="button"
                className="btn btn--outline btn--sm"
                disabled={!params.university_id || Boolean(exporting)}
                onClick={() => handleExport('xlsx')}
              >
                <FileSpreadsheet size={16} aria-hidden />
                {exporting === 'xlsx' ? t('export.generating') : t('export.excel')}
              </button>
            ) : null}
            {capabilities.canPrint ? (
              <button
                type="button"
                className="btn btn--outline btn--sm"
                disabled={!params.university_id}
                onClick={handlePrint}
              >
                <Printer size={16} aria-hidden />
                {t('export.print')}
              </button>
            ) : null}
          </div>
        }
      />

      {actionError ? (
        <p className="crud-muted" role="alert">
          {actionError?.response?.data?.code === 'REPORT_READ_ONLY'
            ? t('states.readOnlyGenerate')
            : getApiErrorMessage(actionError, tCommon('errors.generic'))}
        </p>
      ) : null}
      <FieldTrainingReportFilters value={filters} onChange={setFilters} mode={mode} />

      {!params.university_id ? <p className="crud-muted">{tCommon('tenant.select')}</p> : null}
      {params.university_id && isLoading ? <LoadingSpinner /> : null}
      {params.university_id && isError && error?.response?.status === 403 ? (
        <UnauthorizedPage title={t('global.forbiddenTitle')} description={t('global.forbiddenDescription')} />
      ) : null}
      {params.university_id && isError && error?.response?.status === 404 && capabilities.readOnly ? (
        <p className="crud-muted" role="status">
          {t('states.notGenerated')}
        </p>
      ) : null}
      {params.university_id && isError && error?.response?.status !== 403 && !(error?.response?.status === 404 && capabilities.readOnly) ? (
        <p className="crud-muted">{getApiErrorMessage(error, tCommon('errors.generic'))}</p>
      ) : null}

      {params.university_id && !isLoading && !isError ? (
        <>
          <p className="ft-report-subtitle">
            {data?.university?.name ?? '—'}
            {data?.university?.name_en ? ` · ${data.university.name_en}` : ''}
          </p>
          {stale ? (
            <p className="ft-report-warning" role="status">
              {capabilities.readOnly ? t('states.staleReviewer') : t('states.staleAdmin')}
            </p>
          ) : null}
          {capabilities.readOnly && (summary.total_applicants ?? 0) === 0 ? (
            <p className="crud-muted" role="status">
              {t('states.emptyReviewer')}
            </p>
          ) : null}
          {exporting ? <p className="ft-report-generating" role="status">{t('export.generating')}</p> : null}
          {(data?.data_quality_warnings || []).map((warning) => (
            <p key={warning} className="ft-report-warning" role="status">{warning}</p>
          ))}

          <AdminStatsGrid>
            <StatCard label={t('metrics.totalApplicants')} value={displayReportValue(summary.total_applicants)} />
            <StatCard label={t('metrics.inTraining')} value={displayReportValue(summary.in_training_students)} />
            <StatCard label={t('metrics.completed')} value={displayReportValue(summary.completed_students)} />
            <StatCard
              label={t('metrics.completionRate')}
              value={summary.completion_rate != null ? `${summary.completion_rate}%` : t('common.unavailable')}
            />
            <StatCard
              label={t('metrics.averageAttendance')}
              value={summary.average_attendance != null ? `${summary.average_attendance}%` : t('common.unavailable')}
            />
            <StatCard
              label={t('metrics.trainingHours')}
              value={displayReportValue(summary.total_training_hours, t('common.unavailable'))}
            />
            <StatCard label={t('metrics.eligibleOpportunities')} value={displayReportValue(summary.eligible_opportunities)} />
            <StatCard
              label={t('metrics.trainingOrganizations')}
              value={displayReportValue(summary.active_training_organizations)}
            />
            <StatCard label={t('metrics.completionLetters')} value={displayReportValue(summary.completion_letters_issued)} />
            <StatCard label={t('metrics.atRisk')} value={displayReportValue(summary.at_risk_students)} />
            <StatCard
              label={t('metrics.averagePostAssessment')}
              value={displayReportValue(summary.average_post_assessment_score, t('common.unavailable'))}
            />
            <StatCard
              label={t('metrics.taskSubmissionRate')}
              value={summary.average_task_completion != null ? `${summary.average_task_completion}%` : t('common.unavailable')}
            />
          </AdminStatsGrid>

          <SectionCard title={t('universityReport.charts')}>
            <FieldTrainingReportCharts charts={data?.charts} t={t} />
          </SectionCard>

          <SectionCard title={t('universityReport.bySpecialty')}>
            <DataTable
              columns={[
                { key: 'label', label: t('table.specialty') },
                { key: 'students', label: t('table.applicants') },
                { key: 'active', label: t('metrics.inTraining') },
                { key: 'completed', label: t('table.completed') },
                { key: 'completion_pct', label: t('metrics.completionRate') },
                { key: 'attendance_average', label: t('table.attendanceAvg') },
                { key: 'average_hours', label: t('table.completedHours') },
                { key: 'average_assessment', label: t('table.postAssessmentAvg') },
                { key: 'certificates', label: t('metrics.completionLetters') },
              ]}
              rows={bySpecialty}
            />
          </SectionCard>

          <SectionCard title={t('universityReport.opportunities')}>
            <DataTable
              columns={[
                { key: 'title', label: t('table.opportunity') },
                { key: 'organization_name', label: t('table.organization') },
                { key: 'capacity', label: t('table.capacity') },
                { key: 'applications', label: t('table.applicants') },
                { key: 'accepted_students', label: t('table.accepted') },
                { key: 'completed_students', label: t('table.completed') },
                { key: 'status_label', label: t('table.status') },
              ]}
              rows={data?.opportunities?.rows ?? []}
            />
          </SectionCard>

          <SectionCard title={t('universityReport.organizations')}>
            <DataTable
              columns={[
                { key: 'name', label: t('table.organization') },
                { key: 'hosted_students', label: t('table.student') },
                { key: 'opportunities', label: t('metrics.eligibleOpportunities') },
                { key: 'completed_students', label: t('table.completed') },
                { key: 'completion_rate', label: t('metrics.completionRate') },
                { key: 'average_attendance', label: t('table.attendanceAvg') },
              ]}
              rows={data?.organizations?.rows ?? []}
            />
          </SectionCard>

          <SectionCard title={t('universityReport.risk')}>
            <DataTable
              columns={[
                { key: 'student_name', label: t('table.student') },
                { key: 'issue', label: t('table.issue') },
                { key: 'severity', label: t('table.severity') },
                { key: 'action', label: t('table.requiredAction') },
              ]}
              rows={data?.risk ?? []}
            />
          </SectionCard>

          <SectionCard title={t('universityReport.recommendations')}>
            <DataTable
              columns={[
                { key: 'finding', label: t('table.finding') },
                { key: 'evidence', label: t('table.evidence') },
                { key: 'priority', label: t('table.priority') },
                { key: 'action', label: t('table.requiredAction') },
              ]}
              rows={data?.recommendations ?? []}
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
                { key: 'required_training_hours', label: t('table.requiredHours') },
                { key: 'completed_training_hours', label: t('table.completedHours') },
                { key: 'remaining_training_hours', label: t('table.remainingHours') },
                { key: 'hours_completion_percentage', label: t('table.hoursPercentage') },
                { key: 'hours_completion_status_label', label: t('table.hoursStatus') },
                { key: 'pre_assessment_score', label: t('table.preAssessment') },
                { key: 'post_assessment_score', label: t('table.postAssessment') },
                { key: 'final_task_status', label: t('table.finalTask') },
                { key: 'eligibility_status', label: t('table.eligibility') },
                { key: 'completion_letter_status', label: t('table.completionLetter') },
                {
                  key: 'actions',
                  label: t('table.actions'),
                  render: (row) => (
                    <TableIconActions viewTo={`${paths.student}/${row.application_id}`} />
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
