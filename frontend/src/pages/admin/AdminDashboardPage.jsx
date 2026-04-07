import { Users, Building2, FileSpreadsheet, Activity } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';

export function AdminDashboardPage() {
  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title="لوحة الإدارة"
        description="نظرة تشغيلية موحّدة على المؤشرات الرئيسية والنشاط الأخير."
      />
      <AdminStatsGrid>
        <StatCard label="المستخدمون النشطون" value="—" hint="يُحدَّث عند الربط بالخادم" icon={Users} />
        <StatCard label="الجامعات المسجّلة" value="—" hint="يُحدَّث عند الربط بالخادم" icon={Building2} />
        <StatCard label="التقارير الجاهزة" value="—" hint="يُحدَّث عند الربط بالخادم" icon={FileSpreadsheet} />
        <StatCard label="النشاط اليومي" value="—" hint="يُحدَّث عند الربط بالخادم" icon={Activity} />
      </AdminStatsGrid>
      <SectionCard title="آخر النشاطات">
        <DataTable
          columns={[
            { key: 'when', label: 'الوقت' },
            { key: 'what', label: 'الحدث' },
            { key: 'actor', label: 'المستخدم' },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
