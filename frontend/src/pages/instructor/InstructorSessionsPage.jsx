import { CalendarDays, Clock, MapPin, Video } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';

export function InstructorSessionsPage() {
  return (
    <div className="page page--dashboard page--instructor">
      <AdminPageHeader title="الجلسات" description="جدول الجلسات الحضورية والافتراضية المرتبطة بدفعاتك." />
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالدفعة أو الموضوع" aria-label="بحث" />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="جلسات اليوم" value="—" icon={CalendarDays} />
        <StatCard label="قادمة" value="—" icon={Clock} />
        <StatCard label="حضوري" value="—" icon={MapPin} />
        <StatCard label="عن بُعد" value="—" icon={Video} />
      </AdminStatsGrid>
      <SectionCard title="الجلسات القادمة">
        <DataTable
          columns={[
            { key: 'when', label: 'التاريخ والوقت' },
            { key: 'topic', label: 'الموضوع' },
            { key: 'cohort', label: 'الدفعة' },
            { key: 'mode', label: 'النوع' },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
