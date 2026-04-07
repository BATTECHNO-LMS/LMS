import { FileBadge, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { SelectField } from '../../components/admin/SelectField.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';

export function ReviewerRecognitionRequestsPage() {
  return (
    <div className="page page--dashboard page--reviewer">
      <AdminPageHeader title="طلبات الاعتراف الأكاديمي" description="مراجعة طلبات الاعتراف المقدمة من الجامعة واتخاذ الإجراءات اللازمة." />
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالعنوان أو المرجع" aria-label="بحث" />
        <SelectField id="rec-status" label="الحالة" defaultValue="">
          <option value="">كل الحالات</option>
          <option value="pending">قيد المراجعة</option>
          <option value="approved">معتمد</option>
          <option value="rejected">مرفوض</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="قيد المراجعة" value="—" icon={Clock} />
        <StatCard label="معتمدة" value="—" icon={CheckCircle2} />
        <StatCard label="مرفوضة" value="—" icon={XCircle} />
        <StatCard label="إجمالي الطلبات" value="—" icon={FileBadge} />
      </AdminStatsGrid>
      <SectionCard title="قائمة الطلبات">
        <DataTable
          columns={[
            { key: 'title', label: 'العنوان' },
            { key: 'submitted', label: 'تاريخ التقديم' },
            { key: 'program', label: 'البرنامج' },
            {
              key: 'status',
              label: 'الحالة',
              render: () => <StatusBadge variant="warning">قيد المراجعة</StatusBadge>,
            },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
