import { FileBadge, BarChart3, FolderOpen, Bell } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';

export function ReviewerDashboardPage() {
  return (
    <div className="page page--dashboard page--reviewer">
      <AdminPageHeader
        title="لوحة المراجع الجامعي"
        description="متابعة طلبات الاعتراف والتقارير والأدلة ضمن نفس تجربة الواجهة الإدارية."
      />
      <AdminStatsGrid>
        <StatCard label="طلبات قيد المراجعة" value="—" hint="يُحدَّث عند الربط بالخادم" icon={FileBadge} />
        <StatCard label="تقارير محدّثة" value="—" hint="يُحدَّث عند الربط بالخادم" icon={BarChart3} />
        <StatCard label="أدلة مرفوعة" value="—" hint="يُحدَّث عند الربط بالخادم" icon={FolderOpen} />
        <StatCard label="تنبيهات" value="—" hint="يُحدَّث عند الربط بالخادم" icon={Bell} />
      </AdminStatsGrid>
      <SectionCard title="آخر التحديثات">
        <DataTable
          columns={[
            { key: 'when', label: 'الوقت' },
            { key: 'what', label: 'الحدث' },
            { key: 'ref', label: 'المرجع' },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
