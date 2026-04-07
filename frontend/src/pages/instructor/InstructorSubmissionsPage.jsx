import { Eye, PenLine, MessageSquare, Inbox, CheckCircle2, Hourglass } from 'lucide-react';
import { UI_PERMISSION } from '../../constants/permissions.js';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { PermissionGate } from '../../components/permissions/PermissionGate.jsx';
import { INSTRUCTOR_SUBMISSION_ROWS } from '../../mocks/instructorAssessmentWorkspace.js';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';

export function InstructorSubmissionsPage() {
  const rows = INSTRUCTOR_SUBMISSION_ROWS;
  const P = UI_PERMISSION;

  return (
    <div className="page page--dashboard page--instructor">
      <AdminPageHeader
        title="التسليمات"
        description="مراجعة تسليمات المتعلمين، التصحيح، ونشر الملاحظات."
      />
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالمتعلم أو التقييم" aria-label="بحث" />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="بانتظار المراجعة" value="—" icon={Inbox} />
        <StatCard label="تم التصحيح" value="—" icon={CheckCircle2} />
        <StatCard label="متأخرة" value="—" icon={Hourglass} />
      </AdminStatsGrid>
      <SectionCard title="قائمة التسليمات">
        <DataTable
          columns={[
            { key: 'studentName', label: 'اسم الطالب' },
            { key: 'assessmentName', label: 'التقييم' },
            { key: 'submittedAt', label: 'وقت التسليم' },
            {
              key: 'status',
              label: 'الحالة',
              render: () => <StatusBadge variant="info">مسلّم</StatusBadge>,
            },
            {
              key: 'gradeStatus',
              label: 'حالة الدرجة',
              render: (r) => (
                <StatusBadge variant={r.gradeStatus === 'graded' ? 'success' : 'warning'}>
                  {r.gradeStatus === 'graded' ? 'مصحّح' : 'بانتظار'}
                </StatusBadge>
              ),
            },
            {
              key: 'actions',
              label: 'الإجراءات',
              render: () => (
                <div className="table-row-actions">
                  <button type="button" className="btn btn--icon btn--ghost" title="عرض التسليم" aria-label="عرض التسليم">
                    <Eye size={18} />
                  </button>
                  <PermissionGate permission={P.canGradeAssessments}>
                    <button type="button" className="btn btn--icon btn--ghost" title="تصحيح" aria-label="تصحيح">
                      <PenLine size={18} />
                    </button>
                  </PermissionGate>
                  <PermissionGate permission={P.canPublishFeedback}>
                    <button type="button" className="btn btn--icon btn--ghost" title="ملاحظات" aria-label="ملاحظات">
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
  );
}
