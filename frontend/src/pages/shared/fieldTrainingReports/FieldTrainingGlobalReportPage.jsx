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
import { UnauthorizedPage } from '../../../components/permissions/UnauthorizedPage.jsx';
import { useAuth } from '../../../features/auth/index.js';
import { ROLES } from '../../../constants/roles.js';
import {
  exportFieldTrainingGlobalReport,
  useFieldTrainingGlobalReport,
} from '../../../features/fieldTrainingReports/index.js';
import { FieldTrainingReportFilters, resolveReportParams } from './FieldTrainingReportFilters.jsx';
import { useTenant } from '../../../features/tenant/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

export function FieldTrainingGlobalReportPage({ basePath }) {
  const { t } = useTranslation('fieldTrainingReports');
  const { t: tCommon } = useTranslation('common');
  const { user } = useAuth();
  const { scopeId, isAllTenantsSelected } = useTenant();
  const [filters, setFilters] = useState({});
  const [exporting, setExporting] = useState(null);

  const canView = [ROLES.SUPER_ADMIN].includes(user?.role);
  const params = useMemo(
    () => resolveReportParams(filters, { mode: 'admin', user, scopeId, isAllTenantsSelected }),
    [filters, user, scopeId, isAllTenantsSelected]
  );

  const { data, isLoading, isError, error } = useFieldTrainingGlobalReport(params, {
    enabled: canView,
    staleTime: 30_000,
  });

  const summary = data?.summary ?? {};

  async function handleExport(format) {
    setExporting(format);
    try {
      await exportFieldTrainingGlobalReport(format, params);
    } finally {
      setExporting(null);
    }
  }

  if (!canView) {
    return <UnauthorizedPage title={t('global.forbiddenTitle')} description={t('global.forbiddenDescription')} />;
  }

  return (
    <div className="page page--field-training-reports">
      <AdminPageHeader
        title={t('global.title')}
        description={t('global.description')}
        actions={
          <div className="ft-report-hub__actions">
            <Link className="btn btn--ghost btn--sm" to={basePath}>
              {t('common.backToHub')}
            </Link>
            <button type="button" className="btn btn--outline btn--sm" disabled={exporting === 'pdf'} onClick={() => handleExport('pdf')}>
              <FileDown size={16} aria-hidden />
              {t('export.pdf')}
            </button>
            <button type="button" className="btn btn--outline btn--sm" disabled={exporting === 'xlsx'} onClick={() => handleExport('xlsx')}>
              <FileSpreadsheet size={16} aria-hidden />
              {t('export.excel')}
            </button>
          </div>
        }
      />

      <FieldTrainingReportFilters value={filters} onChange={setFilters} mode="admin" />

      {isLoading ? <LoadingSpinner /> : null}
      {isError ? <p className="crud-muted">{getApiErrorMessage(error, tCommon('errors.generic'))}</p> : null}

      {data && !isLoading ? (
        <>
          <AdminStatsGrid>
            <StatCard label={t('metrics.universities')} value={String(summary.universities_count ?? 0)} />
            <StatCard label={t('metrics.eligibleOpportunities')} value={String(summary.opportunities_count ?? 0)} />
            <StatCard label={t('metrics.totalApplicants')} value={String(summary.applications_count ?? 0)} />
            <StatCard label={t('metrics.accepted')} value={String(summary.accepted_count ?? 0)} />
            <StatCard label={t('metrics.completionLetters')} value={String(summary.completion_letters_count ?? 0)} />
            <StatCard label={t('metrics.expelled')} value={String(summary.expelled_count ?? 0)} />
          </AdminStatsGrid>

          <SectionCard title={t('global.universityComparison')}>
            <DataTable
              columns={[
                { key: 'university_name', label: t('table.university') },
                { key: 'total_applicants', label: t('table.applicants') },
                { key: 'accepted', label: t('table.accepted') },
                { key: 'completed', label: t('table.completed') },
                { key: 'average_attendance', label: t('table.attendanceAvg') },
                { key: 'average_post_assessment', label: t('table.postAssessmentAvg') },
              ]}
              rows={data.university_comparison ?? []}
            />
          </SectionCard>

          <SectionCard title={t('global.specialtyComparison')}>
            <DataTable
              columns={[
                { key: 'label', label: t('table.specialty') },
                { key: 'university_name', label: t('table.university') },
                { key: 'applicants', label: t('table.applicants') },
                { key: 'accepted', label: t('table.accepted') },
                { key: 'attendance_average', label: t('table.attendanceAvg') },
                { key: 'completions', label: t('table.completed') },
              ]}
              rows={data.specialty_comparison ?? []}
            />
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
