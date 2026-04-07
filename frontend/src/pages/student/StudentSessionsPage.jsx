import { CalendarDays, Video, MapPin, Bell } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';

export function StudentSessionsPage() {
  return (
    <div className="page page--dashboard page--student">
      <AdminPageHeader title="الجلسات" description="جدول جلساتك الحضورية والافتراضية والروابط والتذكيرات." />
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالمساق أو التاريخ" aria-label="بحث" />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="هذا الأسبوع" value="—" icon={CalendarDays} />
        <StatCard label="عن بُعد" value="—" icon={Video} />
        <StatCard label="حضوري" value="—" icon={MapPin} />
        <StatCard label="تذكيرات" value="—" icon={Bell} />
      </AdminStatsGrid>
      <SectionCard title="الجلسات القادمة">
        <DataTable
          columns={[
            { key: 'when', label: 'الوقت' },
            { key: 'title', label: 'العنوان' },
            { key: 'course', label: 'المساق' },
            { key: 'link', label: 'الرابط' },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
