import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FileCheck, ClipboardList, Timer, BarChart3, Plus, Eye, Pencil, ListChecks, PenLine, MessageSquare } from 'lucide-react';
import { UI_PERMISSION } from '../../constants/permissions.js';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminActionBar } from '../../components/admin/AdminActionBar.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import { PermissionGate } from '../../components/permissions/PermissionGate.jsx';
import { PagePermissionGate } from '../../components/permissions/PagePermissionGate.jsx';
import { AssessmentTypeBadge } from '../../components/assessment/AssessmentTypeBadge.jsx';
import { genericStatusVariant } from '../../utils/statusMap.js';
import { INSTRUCTOR_ASSESSMENTS } from '../../mocks/instructorAssessmentWorkspace.js';
import { useTenant } from '../../features/tenant/index.js';

export function InstructorAssessmentsPage() {
  const { t } = useTranslation('assessments');
  const { t: tCommon } = useTranslation('common');
  const { filterRows, scopeId } = useTenant();
  const rows = useMemo(() => filterRows(INSTRUCTOR_ASSESSMENTS), [filterRows, scopeId]);
  const P = UI_PERMISSION;

  return (
    <PagePermissionGate permission={P.canViewAssessments}>
      <div className="page page--dashboard page--instructor">
        <AdminPageHeader title={<>{t('instructor.title')}</>} description={<>{t('instructor.description')}</>} />
        <AdminActionBar>
          <PermissionGate permission={P.canCreateAssessments}>
            <Link className="btn btn--primary" to="/instructor/assessments/create">
              <Plus size={18} aria-hidden /> {t('instructor.addAssessment')}
            </Link>
          </PermissionGate>
        </AdminActionBar>
        <AdminFilterBar>
          <SearchInput placeholder={t('instructor.searchPlaceholder')} aria-label={t('instructor.searchAria')} />
        </AdminFilterBar>
        <AdminStatsGrid>
          <StatCard label={t('instructor.stats.active')} value="—" icon={FileCheck} />
          <StatCard label={t('instructor.stats.awaitingGrading')} value="—" icon={ClipboardList} />
          <StatCard label={t('instructor.stats.upcoming')} value="—" icon={Timer} />
          <StatCard label={t('instructor.stats.averageGrades')} value="—" icon={BarChart3} />
        </AdminStatsGrid>
        <SectionCard title={<>{t('instructor.listTitle')}</>}>
          <DataTable
            emptyTitle={t('instructor.empty.title')}
            emptyDescription={t('instructor.empty.description')}
            columns={[
              { key: 'name', label: t('instructor.table.name') },
              {
                key: 'type',
                label: t('instructor.table.type'),
                render: (r) => <AssessmentTypeBadge type={r.type} />,
              },
              { key: 'weight', label: t('instructor.table.weight') },
              { key: 'learningOutcome', label: t('instructor.table.learningOutcome') },
              { key: 'openDate', label: t('instructor.table.openDate') },
              { key: 'closeDate', label: t('instructor.table.closeDate') },
              { key: 'submissionsCount', label: t('instructor.table.submissionsCount') },
              {
                key: 'status',
                label: t('instructor.table.status'),
                render: (r) => (
                  <StatusBadge variant={genericStatusVariant(r.status)}>
                    {t(`instructor.rowStatus.${r.status}`, { defaultValue: r.status })}
                  </StatusBadge>
                ),
              },
              {
                key: 'actions',
                label: tCommon('table.actions'),
                render: (r) => (
                  <div className="table-row-actions">
                    <PermissionGate permission={P.canViewAssessments}>
                      <Link
                        className="btn btn--icon btn--ghost"
                        to="/instructor/submissions"
                        title={t('instructor.actions.viewSubmissions')}
                        aria-label={t('instructor.actions.viewSubmissions')}
                      >
                        <Eye size={18} />
                      </Link>
                    </PermissionGate>
                    <PermissionGate permission={P.canEditAssessments}>
                      <Link
                        className="btn btn--icon btn--ghost"
                        to={`/instructor/assessments/${r.id}/edit`}
                        title={t('instructor.actions.edit')}
                        aria-label={t('instructor.actions.edit')}
                      >
                        <Pencil size={18} />
                      </Link>
                    </PermissionGate>
                    <PermissionGate permission={P.canManageRubric}>
                      <button
                        type="button"
                        className="btn btn--icon btn--ghost"
                        title={t('instructor.actions.manageRubric')}
                        aria-label={t('instructor.actions.manageRubric')}
                      >
                        <ListChecks size={18} />
                      </button>
                    </PermissionGate>
                    <PermissionGate permission={P.canGradeAssessments}>
                      <button
                        type="button"
                        className="btn btn--icon btn--ghost"
                        title={t('instructor.actions.startGrading')}
                        aria-label={t('instructor.actions.startGrading')}
                      >
                        <PenLine size={18} />
                      </button>
                    </PermissionGate>
                    <PermissionGate permission={P.canPublishFeedback}>
                      <button
                        type="button"
                        className="btn btn--icon btn--ghost"
                        title={t('instructor.actions.publishFeedback')}
                        aria-label={t('instructor.actions.publishFeedback')}
                      >
                        <MessageSquare size={18} />
                      </button>
                    </PermissionGate>
                  </div>
                ),
              },
            ]}
            rows={rows}
            footer={
              <PermissionGate permission={P.canCreateAssessments}>
                <div className="data-table__footer-actions">
                  <Link className="btn btn--primary" to="/instructor/assessments/create">
                    <Plus size={18} aria-hidden /> {t('instructor.addAssessment')}
                  </Link>
                </div>
              </PermissionGate>
            }
          />
        </SectionCard>
      </div>
    </PagePermissionGate>
  );
}
