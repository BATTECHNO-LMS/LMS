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
import { INSTRUCTOR_SUBMISSION_ROWS } from '../../mocks/instructorAssessmentWorkspace.js';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import { useLocale } from '../../features/locale/index.js';
import { useTenant } from '../../features/tenant/index.js';

export function InstructorSubmissionsPage() {
  const { t } = useTranslation('submissions');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { filterRows, scopeId } = useTenant();
  const scoped = useMemo(() => filterRows(INSTRUCTOR_SUBMISSION_ROWS), [filterRows, scopeId]);
  const rows = scoped.map((r) => ({
    ...r,
    studentName: isArabic ? r.studentNameAr ?? r.studentName : r.studentNameEn ?? r.studentName,
    assessmentName: isArabic ? r.assessmentNameAr ?? r.assessmentName : r.assessmentNameEn ?? r.assessmentName,
  }));
  const P = UI_PERMISSION;

  return (
    <PagePermissionGate permission={P.canViewSubmissionsTeaching}>
      <div className="page page--dashboard page--instructor">
        <AdminPageHeader title={<>{t('instructor.title')}</>} description={<>{t('instructor.description')}</>} />
        <AdminFilterBar>
          <SearchInput placeholder={t('instructor.searchPlaceholder')} aria-label={t('instructor.searchAria')} />
        </AdminFilterBar>
        <AdminStatsGrid>
          <StatCard label={t('instructor.stats.awaitingReview')} value="—" icon={Inbox} />
          <StatCard label={t('instructor.stats.graded')} value="—" icon={CheckCircle2} />
          <StatCard label={t('instructor.stats.late')} value="—" icon={Hourglass} />
        </AdminStatsGrid>
        <SectionCard title={<>{t('instructor.sectionTitle')}</>}>
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
                render: () => (
                  <StatusBadge variant="info">{t('instructor.submissionStatus.submitted')}</StatusBadge>
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
            rows={rows}
          />
        </SectionCard>
      </div>
    </PagePermissionGate>
  );
}
