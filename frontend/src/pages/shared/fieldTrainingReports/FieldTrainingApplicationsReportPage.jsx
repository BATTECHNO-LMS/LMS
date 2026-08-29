import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LayoutGrid, Table2, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { TableIconActions } from '../../../components/crud/TableIconActions.jsx';
import { useTenant } from '../../../features/tenant/index.js';
import { useAuth, resolveAuthUniversityId } from '../../../features/auth/index.js';
import { ROLES } from '../../../constants/roles.js';
import {
  exportFieldTrainingStudentsExcel,
  useFieldTrainingApplicationsReport,
} from '../../../features/fieldTrainingReports/index.js';
import { studentsExcelErrorMessage } from '../../../features/fieldTraining/fieldTrainingDownload.js';
import { FieldTrainingReportFilters, resolveReportParams } from './FieldTrainingReportFilters.jsx';
import { FieldTrainingReportRoleBanner } from './FieldTrainingReportRoleBanner.jsx';
import { FieldTrainingStudentsExcelButton } from './FieldTrainingStudentsExcelButton.jsx';
import { getReportPaths, mergeReportCapabilities, usesAcademicReportApi } from './reportCapabilities.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { formatFtDate } from '../../../features/fieldTraining/fieldTrainingUi.js';
import { TaskProgressBadge } from '../../../features/fieldTraining/TaskProgressBadge.jsx';

function ProgressBar({ value }) {
  if (value == null || Number.isNaN(Number(value))) {
    return <span className="crud-muted">—</span>;
  }
  const pct = Math.max(0, Math.min(100, Number(value)));
  return (
    <div className="ft-report-progress" title={`${pct}%`}>
      <div className="ft-report-progress__track">
        <div className="ft-report-progress__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="ft-report-progress__label">{pct}%</span>
    </div>
  );
}

export function FieldTrainingApplicationsReportPage({ basePath, mode = 'admin' }) {
  const { t } = useTranslation('fieldTrainingReports');
  const { t: tCommon } = useTranslation('common');
  const { user } = useAuth();
  const { scopeId, isAllTenantsSelected } = useTenant();
  const [searchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState('cards');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [filters, setFilters] = useState(() => ({
    status: searchParams.get('status') || undefined,
    training_status: searchParams.get('training_status') || undefined,
    eligibility_status: searchParams.get('eligibility_status') || undefined,
    opportunity_id: searchParams.get('opportunity_id') || undefined,
    search: searchParams.get('search') || undefined,
  }));

  const params = useMemo(
    () => resolveReportParams(filters, { mode, user, scopeId, isAllTenantsSelected }),
    [filters, mode, user, scopeId, isAllTenantsSelected]
  );

  const universityMissing = usesAcademicReportApi(mode) && !resolveAuthUniversityId(user);
  const paths = getReportPaths(basePath, mode);

  const { data, isLoading, isError, error, refetch } = useFieldTrainingApplicationsReport(params, {
    enabled: Boolean(params.university_id),
    staleTime: 30_000,
    mode,
  });

  const students = data?.students ?? [];
  const capabilities = mergeReportCapabilities(data?.capabilities, user, mode);
  const studentDetailBase = paths.student;
  const hubPath = paths.hub;
  const canExportWithoutUniversity = mode === 'admin' && user?.role === ROLES.SUPER_ADMIN;
  const exportEnabled = Boolean(params.university_id) || canExportWithoutUniversity;

  async function handleExportStudents() {
    if (!exportEnabled || exporting) return;
    setExporting(true);
    setExportError(null);
    setExportSuccess(false);
    try {
      await exportFieldTrainingStudentsExcel(params, mode);
      setExportSuccess(true);
    } catch (err) {
      setExportError(studentsExcelErrorMessage(err, t, getApiErrorMessage(err, t('studentsExcel.failed'))));
    } finally {
      setExporting(false);
    }
  }

  if (universityMissing) {
    return (
      <div className="page page--field-training-reports">
        <AdminPageHeader title={t('applications.title')} description={t('applications.description')} />
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
        title={t('applications.title')}
        description={t('applications.description')}
        actions={
          <div className="ft-report-hub__actions">
            <Link className="btn btn--ghost btn--sm" to={hubPath}>
              {t('common.backToHub')}
            </Link>
            <div className="ft-report-view-toggle" role="group" aria-label={t('applications.viewToggle')}>
              <button
                type="button"
                className={`btn btn--sm ${viewMode === 'cards' ? 'btn--primary' : 'btn--outline'}`}
                onClick={() => setViewMode('cards')}
              >
                <LayoutGrid size={16} aria-hidden />
                {t('applications.cards')}
              </button>
              <button
                type="button"
                className={`btn btn--sm ${viewMode === 'table' ? 'btn--primary' : 'btn--outline'}`}
                onClick={() => setViewMode('table')}
              >
                <Table2 size={16} aria-hidden />
                {t('applications.table')}
              </button>
            </div>
            <FieldTrainingStudentsExcelButton
              onClick={handleExportStudents}
              exporting={exporting}
              disabled={!exportEnabled}
              label={t('studentsExcel.button')}
              exportingLabel={t('studentsExcel.exporting')}
            />
          </div>
        }
      />

      <FieldTrainingReportRoleBanner user={user} mode={mode} capabilities={capabilities} />

      {!params.university_id ? <p className="crud-muted">{tCommon('tenant.select')}</p> : null}
      <FieldTrainingReportFilters value={filters} onChange={setFilters} mode={mode} />

      <label className="admin-field ft-report-search">
        <span className="admin-field__label">
          <Search size={14} aria-hidden /> {t('filters.search')}
        </span>
        <input
          type="search"
          className="admin-field__input"
          value={filters.search ?? ''}
          placeholder={t('filters.searchPlaceholder')}
          onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value || undefined }))}
        />
      </label>

      {exportError ? (
        <p className="form-field__error" role="alert">
          {exportError}
        </p>
      ) : null}
      {exportSuccess && !exportError ? (
        <p className="ft-students-excel-status ft-students-excel-status--ok" role="status">
          {t('studentsExcel.success')}
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
        <SectionCard
          title={`${data?.university?.name ?? t('applications.tableTitle')} (${students.length})`}
        >
          {viewMode === 'table' ? (
            <DataTable
              emptyTitle={t('hub.noApplications')}
              columns={[
                { key: 'student_name', label: t('table.student') },
                { key: 'student_email', label: t('table.email') },
                { key: 'university_specialty_label', label: t('table.specialty') },
                { key: 'opportunity_title', label: t('table.opportunity') },
                { key: 'application_status', label: t('table.applicationStatus') },
                { key: 'training_status', label: t('table.trainingStatus') },
                {
                  key: 'task_progress',
                  label: t('table.taskProgress'),
                  render: (row) =>
                    row.task_progress?.display ? (
                      <TaskProgressBadge progress={row.task_progress} />
                    ) : (
                      '—'
                    ),
                },
                {
                  key: 'progress',
                  label: t('table.progress'),
                  render: (row) => <ProgressBar value={row.hours_completion_percentage ?? row.attendance_percentage} />,
                },
                { key: 'attendance_percentage', label: t('table.attendance') },
                { key: 'pre_assessment_score', label: t('table.preAssessment') },
                { key: 'post_assessment_score', label: t('table.postAssessment') },
                {
                  key: 'post_assessment_attempt_status',
                  label: t('table.postAssessmentStatus'),
                  render: (row) =>
                    row.post_assessment_attempt_status_label || row.post_assessment_score != null
                      ? row.post_assessment_attempt_status_label || 'تم التصحيح'
                      : 'لم يبدأ',
                },
                { key: 'eligibility_status', label: t('table.eligibility') },
                { key: 'completion_letter_status', label: t('table.completionLetter') },
                {
                  key: 'actions',
                  label: t('table.actions'),
                  render: (row) => (
                    <TableIconActions viewTo={`${studentDetailBase}/${row.application_id}`} />
                  ),
                },
              ]}
              rows={students}
            />
          ) : students.length === 0 ? (
            <p className="crud-muted">{t('hub.noApplications')}</p>
          ) : (
            <div className="ft-report-student-grid">
              {students.map((row) => (
                <article key={row.application_id} className="ft-report-student-card">
                  <header className="ft-report-student-card__head">
                    <div>
                      <h3 className="ft-report-student-card__name">{row.student_name || '—'}</h3>
                      <p className="ft-report-student-card__email">{row.student_email || '—'}</p>
                    </div>
                    <span className={`ft-status-badge ft-status-badge--${row.application_status || 'unknown'}`}>
                      {row.application_status || '—'}
                    </span>
                  </header>
                  <dl className="ft-report-detail-grid">
                    <div className="ft-report-detail-grid__item">
                      <dt>{t('table.specialty')}</dt>
                      <dd>{row.university_specialty_label || '—'}</dd>
                    </div>
                    <div className="ft-report-detail-grid__item">
                      <dt>{t('table.opportunity')}</dt>
                      <dd>{row.opportunity_title || '—'}</dd>
                    </div>
                    <div className="ft-report-detail-grid__item">
                      <dt>{t('table.trainingStatus')}</dt>
                      <dd>{row.training_status || '—'}</dd>
                    </div>
                    <div className="ft-report-detail-grid__item">
                      <dt>{t('table.taskProgress')}</dt>
                      <dd>
                        {row.task_progress?.display ? (
                          <TaskProgressBadge progress={row.task_progress} />
                        ) : (
                          '—'
                        )}
                      </dd>
                    </div>
                    <div className="ft-report-detail-grid__item">
                      <dt>{t('table.attendance')}</dt>
                      <dd>{row.attendance_percentage != null ? `${row.attendance_percentage}%` : '—'}</dd>
                    </div>
                    <div className="ft-report-detail-grid__item">
                      <dt>{t('table.preAssessment')}</dt>
                      <dd>{row.pre_assessment_score ?? '—'}</dd>
                    </div>
                    <div className="ft-report-detail-grid__item">
                      <dt>{t('table.postAssessment')}</dt>
                      <dd>{row.post_assessment_score ?? '—'}</dd>
                    </div>
                    <div className="ft-report-detail-grid__item">
                      <dt>{t('table.eligibility')}</dt>
                      <dd>{row.eligibility_status || '—'}</dd>
                    </div>
                    <div className="ft-report-detail-grid__item">
                      <dt>{t('table.completionLetter')}</dt>
                      <dd>{row.completion_letter_status || '—'}</dd>
                    </div>
                    <div className="ft-report-detail-grid__item">
                      <dt>{t('filters.from')}</dt>
                      <dd>{formatFtDate(row.submitted_at)}</dd>
                    </div>
                  </dl>
                  <div className="ft-report-student-card__progress">
                    <span>{t('table.progress')}</span>
                    <ProgressBar value={row.hours_completion_percentage ?? row.attendance_percentage} />
                  </div>
                  <footer className="ft-report-student-card__foot">
                    <Link
                      className="btn btn--outline btn--sm"
                      to={`${studentDetailBase}/${row.application_id}`}
                    >
                      {t('applications.viewJourney')}
                    </Link>
                  </footer>
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}
    </div>
  );
}
