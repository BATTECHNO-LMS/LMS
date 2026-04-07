import { ClipboardCheck, Percent, Calendar, UserCheck } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';

export function StudentAttendancePage() {
  return (
    <div className="page page--dashboard page--student">
      <AdminPageHeader title="الحضور" description="عرض نسب حضورك في الجلسات وفق كل مساق مسجّل." />
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالمساق" aria-label="بحث" />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="نسبة الحضور" value="—" icon={Percent} />
        <StatCard label="جلسات محسوبة" value="—" icon={Calendar} />
        <StatCard label="حضور" value="—" icon={UserCheck} />
        <StatCard label="غياب" value="—" icon={ClipboardCheck} />
      </AdminStatsGrid>
      <SectionCard title="التفصيل حسب المساق">
        <DataTable
          columns={[
            { key: 'course', label: 'المساق' },
            { key: 'sessions', label: 'الجلسات' },
            { key: 'rate', label: 'النسبة' },
            { key: 'status', label: 'الحالة' },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
