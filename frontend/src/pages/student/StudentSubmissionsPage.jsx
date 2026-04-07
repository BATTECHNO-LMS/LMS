import { Eye, Upload, Pencil } from 'lucide-react';
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
import { Upload as UploadIcon, CheckCircle2, XCircle, History } from 'lucide-react';
import { STUDENT_SUBMISSION_ROWS } from '../../mocks/instructorAssessmentWorkspace.js';

export function StudentSubmissionsPage() {
  const rows = STUDENT_SUBMISSION_ROWS;
  const P = UI_PERMISSION;

  return (
    <div className="page page--dashboard page--student">
      <AdminPageHeader title="التسليمات" description="سجل تسليماتك وحالات التصحيح والدرجات عند توفرها." />
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالتقييم" aria-label="بحث" />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="مقبولة" value="—" icon={CheckCircle2} />
        <StatCard label="تحتاج إعادة" value="—" icon={XCircle} />
        <StatCard label="السجل" value="—" icon={History} />
        <StatCard label="إجمالي" value="—" icon={UploadIcon} />
      </AdminStatsGrid>
      <SectionCard title="تسليماتي">
        <DataTable
          emptyTitle="لم تقم برفع أي تسليمات بعد"
          emptyDescription="اختر تقييماً من صفحة التقييمات لرفع التسليم عند فتحه."
          columns={[
            { key: 'assessmentName', label: 'اسم التقييم' },
            {
              key: 'type',
              label: 'النوع',
              render: (r) => <AssessmentTypeBadge type={r.type} />,
            },
            { key: 'submittedAt', label: 'تاريخ التسليم' },
            {
              key: 'state',
              label: 'الحالة',
              render: (r) => <SubmissionStatusBadge state={r.state} />,
            },
            { key: 'score', label: 'الدرجة' },
            {
              key: 'actions',
              label: 'الإجراءات',
              render: (r) => (
                <div className="table-row-actions">
                  <button type="button" className="btn btn--icon btn--ghost" title="عرض" aria-label="عرض">
                    <Eye size={18} />
                  </button>
                  <PermissionGate permission={P.canSubmitAssessments}>
                    {r.state === 'late' || r.state === 'open' ? (
                      <button type="button" className="btn btn--icon btn--ghost" title="رفع" aria-label="رفع">
                        <Upload size={18} />
                      </button>
                    ) : null}
                  </PermissionGate>
                  <PermissionGate permission={P.canEditOwnSubmission}>
                    {r.state === 'submitted' ? (
                      <button type="button" className="btn btn--icon btn--ghost" title="تعديل" aria-label="تعديل">
                        <Pencil size={18} />
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
