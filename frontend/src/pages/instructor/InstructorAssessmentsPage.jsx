import { Link } from 'react-router-dom';
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
import { AssessmentTypeBadge } from '../../components/assessment/AssessmentTypeBadge.jsx';
import { genericStatusVariant, statusLabelAr } from '../../utils/statusMap.js';
import { INSTRUCTOR_ASSESSMENTS } from '../../mocks/instructorAssessmentWorkspace.js';

export function InstructorAssessmentsPage() {
  const rows = INSTRUCTOR_ASSESSMENTS;
  const P = UI_PERMISSION;

  return (
    <div className="page page--dashboard page--instructor">
      <AdminPageHeader
        title="التقييمات"
        description="إدارة تقييمات الدفعات المسندة إليك: الإنشاء، التصحيح، الـ Rubric، ونشر الملاحظات."
      />
      <AdminActionBar>
        <PermissionGate permission={P.canCreateAssessments}>
          <Link className="btn btn--primary" to="/instructor/assessments/create">
            <Plus size={18} aria-hidden /> إضافة تقييم
          </Link>
        </PermissionGate>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput placeholder="بحث باسم التقييم أو الدفعة" aria-label="بحث" />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="تقييمات نشطة" value="—" icon={FileCheck} />
        <StatCard label="بانتظار التصحيح" value="—" icon={ClipboardList} />
        <StatCard label="مواعيد قريبة" value="—" icon={Timer} />
        <StatCard label="متوسط الدرجات" value="—" icon={BarChart3} />
      </AdminStatsGrid>
      <SectionCard title="قائمة التقييمات">
        <DataTable
          emptyTitle="لم يتم إنشاء تقييمات لهذه الدفعة بعد"
          emptyDescription="ابدأ بإضافة تقييم جديد لربطه بالدفعة ومخرجات التعلم."
          columns={[
            { key: 'name', label: 'اسم التقييم' },
            {
              key: 'type',
              label: 'النوع',
              render: (r) => <AssessmentTypeBadge type={r.type} />,
            },
            { key: 'weight', label: 'الوزن %' },
            { key: 'learningOutcome', label: 'مخرج التعلم' },
            { key: 'openDate', label: 'تاريخ الفتح' },
            { key: 'closeDate', label: 'تاريخ الإغلاق' },
            { key: 'submissionsCount', label: 'عدد التسليمات' },
            {
              key: 'status',
              label: 'الحالة',
              render: (r) => (
                <StatusBadge variant={genericStatusVariant(r.status)}>{statusLabelAr(r.status)}</StatusBadge>
              ),
            },
            {
              key: 'actions',
              label: 'الإجراءات',
              render: (r) => (
                <div className="table-row-actions">
                  <PermissionGate permission={P.canViewAssessments}>
                    <Link className="btn btn--icon btn--ghost" to={`/instructor/submissions`} title="عرض التسليمات" aria-label="عرض التسليمات">
                      <Eye size={18} />
                    </Link>
                  </PermissionGate>
                  <PermissionGate permission={P.canEditAssessments}>
                    <Link className="btn btn--icon btn--ghost" to={`/instructor/assessments/${r.id}/edit`} title="تعديل" aria-label="تعديل">
                      <Pencil size={18} />
                    </Link>
                  </PermissionGate>
                  <PermissionGate permission={P.canManageRubric}>
                    <button type="button" className="btn btn--icon btn--ghost" title="إدارة Rubric" aria-label="إدارة Rubric">
                      <ListChecks size={18} />
                    </button>
                  </PermissionGate>
                  <PermissionGate permission={P.canGradeAssessments}>
                    <button type="button" className="btn btn--icon btn--ghost" title="بدء التصحيح" aria-label="بدء التصحيح">
                      <PenLine size={18} />
                    </button>
                  </PermissionGate>
                  <PermissionGate permission={P.canPublishFeedback}>
                    <button type="button" className="btn btn--icon btn--ghost" title="نشر Feedback" aria-label="نشر Feedback">
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
                  <Plus size={18} aria-hidden /> إضافة تقييم
                </Link>
              </div>
            </PermissionGate>
          }
        />
      </SectionCard>
    </div>
  );
}
