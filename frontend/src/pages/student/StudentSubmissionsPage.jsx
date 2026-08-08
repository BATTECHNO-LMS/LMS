import { Eye, Pencil } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UI_PERMISSION } from '../../constants/permissions.js';
import { isAcademicSubmissionEditable } from '../../features/assessments/academicStatusMap.js';
import { StudentPageHeader } from '../../components/student/StudentPageHeader.jsx';
import { ContextualHelpButton } from '../../components/help/ContextualHelpButton.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { PermissionGate } from '../../components/permissions/PermissionGate.jsx';
import { PagePermissionGate } from '../../components/permissions/PagePermissionGate.jsx';
import { AssessmentTypeBadge } from '../../components/assessment/AssessmentTypeBadge.jsx';
import { SubmissionStatusBadge } from '../../components/assessment/SubmissionStatusBadge.jsx';
import { Upload as UploadIcon, CheckCircle2, XCircle, History } from 'lucide-react';
import { useSubmissions } from '../../features/submissions/index.js';
import { useGrades } from '../../features/grades/index.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

export function StudentSubmissionsPage() {
  const { t } = useTranslation('submissions');
  const { t: tCommon } = useTranslation('common');
  const {
    data: submissionsPayload,
    isLoading: submissionsLoading,
    isError: submissionsError,
    error: submissionsErrorObj,
  } = useSubmissions({}, { staleTime: 30_000 });
  const { data: gradesPayload, isLoading: gradesLoading } = useGrades({}, { staleTime: 30_000 });
  const scoreByAssessment = useMemo(() => {
    const map = new Map();
    for (const g of gradesPayload?.grades ?? []) {
      map.set(g.assessment_id, g.score != null ? String(g.score) : '—');
    }
    return map;
  }, [gradesPayload]);
  const rows = useMemo(
    () =>
      (submissionsPayload?.submissions ?? []).map((s) => ({
        id: s.id,
        assessmentId: s.assessment_id,
        assessmentName: s.assessment?.title ?? '—',
        type: s.assessment?.assessment_type ?? s.submission_type,
        submittedAt: s.submitted_at ? String(s.submitted_at).slice(0, 19) : '—',
        state: s.status,
        score: scoreByAssessment.get(s.assessment_id) ?? '—',
        canEdit: isAcademicSubmissionEditable(s),
      })),
    [submissionsPayload, scoreByAssessment]
  );
  const P = UI_PERMISSION;
  const loading = submissionsLoading || gradesLoading;
  const loadError = submissionsError ? getApiErrorMessage(submissionsErrorObj, tCommon('errors.generic')) : '';
  const accepted = rows.filter((r) => r.state === 'graded' || r.state === 'submitted').length;
  const needsRedo = rows.filter((r) => r.state === 'returned').length;
  const history = rows.length;

  return (
    <PagePermissionGate permission={P.canViewSubmissionStatus}>
      <div className="page page--dashboard page--student">
        <div className="ug-page-tools">
          <StudentPageHeader title={<>{t('student.title')}</>} description={<>{t('student.description')}</>} />
          <ContextualHelpButton contextualKey="tasks" route="/student/submissions" />
        </div>
        <AdminFilterBar>
          <SearchInput placeholder={t('student.searchPlaceholder')} aria-label={t('student.searchAria')} />
        </AdminFilterBar>
        <AdminStatsGrid>
          <StatCard label={t('student.stats.accepted')} value={String(accepted)} icon={CheckCircle2} />
          <StatCard label={t('student.stats.needsRedo')} value={String(needsRedo)} icon={XCircle} />
          <StatCard label={t('student.stats.history')} value={String(history)} icon={History} />
          <StatCard label={t('student.stats.total')} value={String(rows.length)} icon={UploadIcon} />
        </AdminStatsGrid>
        <SectionCard title={<>{t('student.sectionTitle')}</>}>
          {loading ? <LoadingSpinner /> : null}
          {loadError ? <p className="crud-muted">{loadError}</p> : null}
          {!loading ? (
            <DataTable
              emptyTitle={t('student.empty.title')}
              emptyDescription={t('student.empty.description')}
              columns={[
                { key: 'assessmentName', label: t('student.table.assessmentName') },
                {
                  key: 'type',
                  label: t('student.table.type'),
                  render: (r) => <AssessmentTypeBadge type={r.type} />,
                },
                { key: 'submittedAt', label: t('student.table.submittedAt') },
                {
                  key: 'state',
                  label: t('student.table.state'),
                  render: (r) => <SubmissionStatusBadge state={r.state} />,
                },
                { key: 'score', label: t('student.table.score') },
                {
                  key: 'actions',
                  label: tCommon('table.actions'),
                  render: (r) => (
                    <div className="table-row-actions">
                      <PermissionGate permission={P.canViewSubmissionStatus}>
                        <Link
                          to={`/student/assessments/${r.assessmentId}/submit`}
                          className="btn btn--icon btn--ghost"
                          title={t('student.actions.view')}
                          aria-label={t('student.actions.view')}
                        >
                          <Eye size={18} />
                        </Link>
                      </PermissionGate>
                      <PermissionGate permission={P.canEditOwnSubmission}>
                        {r.canEdit ? (
                          <Link
                            to={`/student/assessments/${r.assessmentId}/submit`}
                            className="btn btn--icon btn--ghost"
                            title={t('student.actions.edit')}
                            aria-label={t('student.actions.edit')}
                          >
                            <Pencil size={18} />
                          </Link>
                        ) : null}
                      </PermissionGate>
                    </div>
                  ),
                },
              ]}
              rows={loadError ? [] : rows}
            />
          ) : null}
        </SectionCard>
      </div>
    </PagePermissionGate>
  );
}
