import { Eye, Upload, Pencil, MessageSquare, FileCheck, Timer, Send, ListChecks } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { UI_PERMISSION } from '../../constants/permissions.js';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
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
import { useAssessments } from '../../features/assessments/index.js';
import { useSubmissions } from '../../features/submissions/index.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

export function StudentAssessmentsPage() {
  const { t } = useTranslation('assessments');
  const { t: tCommon } = useTranslation('common');
  const {
    data: assessmentsPayload,
    isLoading: assessmentsLoading,
    isError: assessmentsError,
    error: assessmentsErrorObj,
  } = useAssessments({}, { staleTime: 30_000 });
  const {
    data: submissionsPayload,
    isLoading: submissionsLoading,
    isError: submissionsError,
    error: submissionsErrorObj,
  } = useSubmissions({}, { staleTime: 30_000 });
  const submissionsByAssessment = useMemo(() => {
    const map = new Map();
    for (const s of submissionsPayload?.submissions ?? []) {
      map.set(s.assessment_id, s);
    }
    return map;
  }, [submissionsPayload]);
  const rows = useMemo(
    () =>
      (assessmentsPayload?.assessments ?? []).map((a) => {
        const sub = submissionsByAssessment.get(a.id);
        return {
          id: a.id,
          name: a.title,
          type: a.assessment_type,
          due: a.due_date ? String(a.due_date).slice(0, 10) : '—',
          submissionState: sub?.status ?? (a.status === 'closed' ? 'graded' : 'open'),
        };
      }),
    [assessmentsPayload, submissionsByAssessment]
  );
  const P = UI_PERMISSION;
  const loading = assessmentsLoading || submissionsLoading;
  const loadError = assessmentsError
    ? getApiErrorMessage(assessmentsErrorObj, tCommon('errors.generic'))
    : submissionsError
      ? getApiErrorMessage(submissionsErrorObj, tCommon('errors.generic'))
      : '';
  const openCount = rows.filter((r) => r.submissionState === 'open' || r.submissionState === 'late').length;
  const submittedCount = rows.filter((r) => ['submitted', 'resubmitted', 'graded'].includes(r.submissionState)).length;
  const upcomingCount = rows.filter((r) => r.due !== '—').length;

  return (
    <PagePermissionGate permission={P.canViewAssessments}>
      <div className="page page--dashboard page--student">
        <AdminPageHeader
          title={<>{t('student.title')}</>}
          description={<>{t('student.description')}</>}
        />
        <AdminFilterBar>
          <SearchInput placeholder={t('student.searchPlaceholder')} aria-label={t('student.searchAria')} />
        </AdminFilterBar>
        <AdminStatsGrid>
          <StatCard label={t('student.stats.open')} value={String(openCount)} icon={ListChecks} />
          <StatCard label={t('student.stats.submitted')} value={String(submittedCount)} icon={Send} />
          <StatCard label={t('student.stats.upcoming')} value={String(upcomingCount)} icon={Timer} />
          <StatCard label={t('student.stats.total')} value={String(rows.length)} icon={FileCheck} />
        </AdminStatsGrid>
        <SectionCard title={<>{t('student.sectionTitle')}</>}>
          {loading ? <LoadingSpinner /> : null}
          {loadError ? <p className="crud-muted">{loadError}</p> : null}
          {!loading ? (
            <DataTable
              emptyTitle={t('student.empty.title')}
              emptyDescription={t('student.empty.description')}
              columns={[
                { key: 'name', label: t('student.table.name') },
                {
                  key: 'type',
                  label: t('student.table.type'),
                  render: (r) => <AssessmentTypeBadge type={r.type} />,
                },
                { key: 'due', label: t('student.table.due') },
                {
                  key: 'submissionState',
                  label: t('student.table.submissionState'),
                  render: (r) => <SubmissionStatusBadge state={r.submissionState} />,
                },
                {
                  key: 'actions',
                  label: tCommon('table.actions'),
                  render: (r) => (
                    <div className="table-row-actions">
                      <PermissionGate permission={P.canViewAssessments}>
                        <button
                          type="button"
                          className="btn btn--icon btn--ghost"
                          title={t('student.actions.viewDetails')}
                          aria-label={t('student.actions.viewDetails')}
                        >
                          <Eye size={18} />
                        </button>
                      </PermissionGate>
                      <PermissionGate permission={P.canSubmitAssessments}>
                        {r.submissionState === 'open' || r.submissionState === 'late' ? (
                          <button
                            type="button"
                            className="btn btn--icon btn--ghost"
                            title={t('student.actions.upload')}
                            aria-label={t('student.actions.upload')}
                          >
                            <Upload size={18} />
                          </button>
                        ) : null}
                      </PermissionGate>
                      <PermissionGate permission={P.canEditOwnSubmission}>
                        {r.submissionState === 'open' || r.submissionState === 'draft' ? (
                          <button
                            type="button"
                            className="btn btn--icon btn--ghost"
                            title={t('student.actions.editSubmission')}
                            aria-label={t('student.actions.editSubmission')}
                          >
                            <Pencil size={18} />
                          </button>
                        ) : null}
                      </PermissionGate>
                      <PermissionGate permission={P.canViewFeedback}>
                        {r.submissionState === 'graded' ? (
                          <button
                            type="button"
                            className="btn btn--icon btn--ghost"
                            title={t('student.actions.viewFeedback')}
                            aria-label={t('student.actions.viewFeedback')}
                          >
                            <MessageSquare size={18} />
                          </button>
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
