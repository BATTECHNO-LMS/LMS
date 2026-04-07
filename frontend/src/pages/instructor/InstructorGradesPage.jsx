import { BarChart3, Award, Users, ClipboardCheck } from 'lucide-react';
import { UI_PERMISSION } from '../../constants/permissions.js';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { PermissionGate } from '../../components/permissions/PermissionGate.jsx';
import { Button } from '../../components/common/Button.jsx';

const GRADING_ROWS = [
  { id: '1', student: 'محمد علي', assessment: 'واجب التحليل', score: '—', status: 'جاهز للنشر' },
];

export function InstructorGradesPage() {
  const P = UI_PERMISSION;

  return (
    <div className="page page--dashboard page--instructor">
      <AdminPageHeader
        title="الدرجات"
        description="جدول التصحيح والدرجات الجاهزة للنشر للدفعات المسندة إليك."
      />
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالطالب أو التقييم" aria-label="بحث" />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="بانتظار النشر" value="—" icon={ClipboardCheck} />
        <StatCard label="متوسط الدفعة" value="—" icon={BarChart3} />
        <StatCard label="طلبة" value="—" icon={Users} />
        <StatCard label="أعلى درجة" value="—" icon={Award} />
      </AdminStatsGrid>
      <SectionCard title="جدول الدرجات">
        <DataTable
          columns={[
            { key: 'student', label: 'الطالب' },
            { key: 'assessment', label: 'التقييم' },
            { key: 'score', label: 'الدرجة' },
            { key: 'status', label: 'الحالة' },
            {
              key: 'actions',
              label: 'الإجراءات',
              render: () => (
                <div className="table-row-actions">
                  <PermissionGate permission={P.canGradeAssessments}>
                    <Button type="button" variant="outline">
                      تعديل
                    </Button>
                  </PermissionGate>
                  <PermissionGate permission={P.canPublishFeedback}>
                    <Button type="button" variant="primary">
                      نشر
                    </Button>
                  </PermissionGate>
                </div>
              ),
            },
          ]}
          rows={GRADING_ROWS}
        />
      </SectionCard>
    </div>
  );
}
