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
import { STUDENT_ASSESSMENTS } from '../../mocks/instructorAssessmentWorkspace.js';
import { useTenant } from '../../features/tenant/index.js';

export function StudentAssessmentsPage() {
  const { t } = useTranslation('assessments');
  const { t: tCommon } = useTranslation('common');
  const { filterRows, scopeId } = useTenant();
  const rows = useMemo(() => filterRows(STUDENT_ASSESSMENTS), [filterRows, scopeId]);
  const P = UI_PERMISSION;

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
          <StatCard label={t('student.stats.open')} value="—" icon={ListChecks} />
          <StatCard label={t('student.stats.submitted')} value="—" icon={Send} />
          <StatCard label={t('student.stats.upcoming')} value="—" icon={Timer} />
          <StatCard label={t('student.stats.total')} value="—" icon={FileCheck} />
        </AdminStatsGrid>
        <SectionCard title={<>{t('student.sectionTitle')}</>}>
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
            rows={rows}
          />
        </SectionCard>
      </div>
    </PagePermissionGate>
  );
}
