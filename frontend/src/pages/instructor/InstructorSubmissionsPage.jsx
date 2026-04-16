import { Eye, PenLine, MessageSquare, Inbox, CheckCircle2, Hourglass } from 'lucide-react';
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
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import { useLocale } from '../../features/locale/index.js';
import { useSubmissions } from '../../features/submissions/index.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

export function InstructorSubmissionsPage() {
  const { t } = useTranslation('submissions');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const {
    data: submissionsPayload,
    isLoading,
    isError,
    error,
  } = useSubmissions({}, { staleTime: 30_000 });
  const rows = useMemo(
    () =>
      (submissionsPayload?.submissions ?? []).map((s) => ({
        id: s.id,
        studentName: s.student?.full_name ?? '—',
        assessmentName: s.assessment?.title ?? '—',
        submittedAt: s.submitted_at ? new Date(s.submitted_at).toLocaleString(locale) : '—',
        gradeStatus: s.status === 'graded' ? 'graded' : 'pending',
        status: s.status,
      })),
    [submissionsPayload, locale]
  );
  const P = UI_PERMISSION;
  const awaiting = rows.filter((r) => r.status === 'submitted' || r.status === 'late').length;
  const graded = rows.filter((r) => r.status === 'graded').length;
  const late = rows.filter((r) => r.status === 'late').length;
  const loadError = isError ? getApiErrorMessage(error, tCommon('errors.generic')) : '';

  return (
    <PagePermissionGate permission={P.canViewSubmissionsTeaching}>
      <div className="page page--dashboard page--instructor">
        <AdminPageHeader title={<>{t('instructor.title')}</>} description={<>{t('instructor.description')}</>} />
        <AdminFilterBar>
          <SearchInput placeholder={t('instructor.searchPlaceholder')} aria-label={t('instructor.searchAria')} />
        </AdminFilterBar>
        <AdminStatsGrid>
          <StatCard label={t('instructor.stats.awaitingReview')} value={String(awaiting)} icon={Inbox} />
          <StatCard label={t('instructor.stats.graded')} value={String(graded)} icon={CheckCircle2} />
          <StatCard label={t('instructor.stats.late')} value={String(late)} icon={Hourglass} />
        </AdminStatsGrid>
        <SectionCard title={<>{t('instructor.sectionTitle')}</>}>
          {isLoading ? <LoadingSpinner /> : null}
          {loadError ? <p className="crud-muted">{loadError}</p> : null}
          {!isLoading ? (
            <DataTable
              emptyTitle={t('instructor.empty.title')}
              emptyDescription={t('instructor.empty.description')}
              columns={[
                { key: 'studentName', label: t('instructor.table.studentName') },
                { key: 'assessmentName', label: t('instructor.table.assessmentName') },
                { key: 'submittedAt', label: t('instructor.table.submittedAt') },
                {
                  key: 'status',
                  label: t('instructor.table.status'),
                  render: (r) => (
                    <StatusBadge variant={r.status === 'late' ? 'warning' : 'info'}>
                      {r.status === 'late'
                        ? t('instructor.submissionStatus.late', { defaultValue: 'Late' })
                        : t('instructor.submissionStatus.submitted')}
                    </StatusBadge>
                  ),
                },
                {
                  key: 'gradeStatus',
                  label: t('instructor.table.gradeStatus'),
                  render: (r) => (
                    <StatusBadge variant={r.gradeStatus === 'graded' ? 'success' : 'warning'}>
                      {r.gradeStatus === 'graded'
                        ? t('instructor.gradeStatus.graded')
                        : t('instructor.gradeStatus.pending')}
                    </StatusBadge>
                  ),
                },
                {
                  key: 'actions',
                  label: tCommon('table.actions'),
                  render: () => (
                    <div className="table-row-actions">
                      <PermissionGate permission={P.canViewSubmissionsTeaching}>
                        <button
                          type="button"
                          className="btn btn--icon btn--ghost"
                          title={t('instructor.actions.viewSubmission')}
                          aria-label={t('instructor.actions.viewSubmission')}
                        >
                          <Eye size={18} />
                        </button>
                      </PermissionGate>
                      <PermissionGate permission={P.canGradeAssessments}>
                        <button
                          type="button"
                          className="btn btn--icon btn--ghost"
                          title={t('instructor.actions.grade')}
                          aria-label={t('instructor.actions.grade')}
                        >
                          <PenLine size={18} />
                        </button>
                      </PermissionGate>
                      <PermissionGate permission={P.canPublishFeedback}>
                        <button
                          type="button"
                          className="btn btn--icon btn--ghost"
                          title={t('instructor.actions.feedback')}
                          aria-label={t('instructor.actions.feedback')}
                        >
                          <MessageSquare size={18} />
                        </button>
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
