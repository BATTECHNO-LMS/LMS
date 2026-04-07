import { Eye, Upload, Pencil, MessageSquare, FileCheck, Timer, Send, ListChecks } from 'lucide-react';
import { UI_PERMISSION } from '../../constants/permissions.js';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { PermissionGate } from '../../components/permissions/PermissionGate.jsx';
import { AssessmentTypeBadge } from '../../components/assessment/AssessmentTypeBadge.jsx';
import { SubmissionStatusBadge } from '../../components/assessment/SubmissionStatusBadge.jsx';
import { STUDENT_ASSESSMENTS } from '../../mocks/instructorAssessmentWorkspace.js';

export function StudentAssessmentsPage() {
  const rows = STUDENT_ASSESSMENTS;
  const P = UI_PERMISSION;

  return (
    <div className="page page--dashboard page--student">
      <AdminPageHeader
        title="التقييمات"
        description="عرض التقييمات المسجّل بها، المواعيد، وحالة التسليم والتقييم."
      />
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالتقييم أو المساق" aria-label="بحث" />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="مفتوحة" value="—" icon={ListChecks} />
        <StatCard label="مسلّمة" value="—" icon={Send} />
        <StatCard label="مواعيد قريبة" value="—" icon={Timer} />
        <StatCard label="إجمالي" value="—" icon={FileCheck} />
      </AdminStatsGrid>
      <SectionCard title="التقييمات">
        <DataTable
          emptyTitle="لا توجد تقييمات متاحة حاليًا"
          emptyDescription="ستظهر التقييمات المرتبطة بشهاداتك عند تفعيل المساق."
          columns={[
            { key: 'name', label: 'عنوان التقييم' },
            {
              key: 'type',
              label: 'النوع',
              render: (r) => <AssessmentTypeBadge type={r.type} />,
            },
            { key: 'due', label: 'تاريخ الاستحقاق' },
            {
              key: 'submissionState',
              label: 'حالة التسليم',
              render: (r) => <SubmissionStatusBadge state={r.submissionState} />,
            },
            {
              key: 'actions',
              label: 'الإجراءات',
              render: (r) => (
                <div className="table-row-actions">
                  <PermissionGate permission={P.canViewAssessments}>
                    <button type="button" className="btn btn--icon btn--ghost" title="عرض التفاصيل" aria-label="عرض التفاصيل">
                      <Eye size={18} />
                    </button>
                  </PermissionGate>
                  <PermissionGate permission={P.canSubmitAssessments}>
                    {r.submissionState === 'open' || r.submissionState === 'late' ? (
                      <button type="button" className="btn btn--icon btn--ghost" title="رفع التسليم" aria-label="رفع التسليم">
                        <Upload size={18} />
                      </button>
                    ) : null}
                  </PermissionGate>
                  <PermissionGate permission={P.canEditOwnSubmission}>
                    {r.submissionState === 'open' || r.submissionState === 'draft' ? (
                      <button type="button" className="btn btn--icon btn--ghost" title="تعديل التسليم" aria-label="تعديل التسليم">
                        <Pencil size={18} />
                      </button>
                    ) : null}
                  </PermissionGate>
                  <PermissionGate permission={P.canViewFeedback}>
                    {r.submissionState === 'graded' ? (
                      <button type="button" className="btn btn--icon btn--ghost" title="عرض التغذية الراجعة" aria-label="عرض التغذية الراجعة">
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
  );
}
