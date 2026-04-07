import { GraduationCap, BookMarked, Clock, CheckCircle2 } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';

export function MyProgramsPage() {
  return (
    <div className="page page--dashboard page--student">
      <AdminPageHeader title="شهاداتي المسجل بها" description="عرض البرامج والشهادات التي سجّلت بها وتقدّمك في كل منها." />
      <AdminFilterBar>
        <SearchInput placeholder="بحث باسم البرنامج" aria-label="بحث" />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="برامج نشطة" value="—" icon={GraduationCap} />
        <StatCard label="وحدات مكتملة" value="—" icon={CheckCircle2} />
        <StatCard label="ساعات معتمدة" value="—" icon={BookMarked} />
        <StatCard label="مواعيد قادمة" value="—" icon={Clock} />
      </AdminStatsGrid>
      <SectionCard title="قائمة التسجيلات">
        <DataTable
          emptyTitle="لا توجد شهادات مسجّل بها"
          emptyDescription="ستظهر الشهادات المصغّرة والدفعات التي انضممت إليها عند اكتمال التسجيل."
          columns={[
            { key: 'name', label: 'البرنامج / الشهادة' },
            { key: 'progress', label: 'التقدم' },
            { key: 'cohort', label: 'الدفعة' },
            {
              key: 'status',
              label: 'الحالة',
              render: () => <StatusBadge variant="success">مسجّل</StatusBadge>,
            },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
