import { CalendarDays, Layers, Upload, AlertTriangle } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';

export function InstructorDashboardPage() {
  return (
    <div className="page page--dashboard page--instructor">
      <AdminPageHeader
        title="لوحة المدرب"
        description="متابعة الدفعات والجلسات والتقييمات الخاصة بك ضمن النظام الموحّد."
      />
      <AdminStatsGrid>
        <StatCard label="الجلسات هذا الأسبوع" value="—" hint="يُحدَّث عند الربط بالخادم" icon={CalendarDays} />
        <StatCard label="دفعاتي النشطة" value="—" hint="يُحدَّث عند الربط بالخادم" icon={Layers} />
        <StatCard label="تسليمات بانتظار التصحيح" value="—" hint="يُحدَّث عند الربط بالخادم" icon={Upload} />
        <StatCard label="تنبيهات الطلبة" value="—" hint="يُحدَّث عند الربط بالخادم" icon={AlertTriangle} />
      </AdminStatsGrid>
      <SectionCard title="نشاط قريب">
        <DataTable
          columns={[
            { key: 'when', label: 'الوقت' },
            { key: 'what', label: 'الحدث' },
            { key: 'cohort', label: 'الدفعة' },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
