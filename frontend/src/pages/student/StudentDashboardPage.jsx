import { ClipboardList, Upload, Award, BookOpen } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';

export function StudentDashboardPage() {
  return (
    <div className="page page--dashboard page--student">
      <AdminPageHeader
        title="لوحة الطالب"
        description="متابعة تقدّمك الدراسي والمهام والمواعيد ضمن الواجهة الموحّدة للنظام."
      />
      <AdminStatsGrid>
        <StatCard label="مهام مفتوحة" value="—" hint="يُحدَّث عند الربط بالخادم" icon={ClipboardList} />
        <StatCard label="تسليمات" value="—" hint="يُحدَّث عند الربط بالخادم" icon={Upload} />
        <StatCard label="درجات منشورة" value="—" hint="يُحدَّث عند الربط بالخادم" icon={Award} />
        <StatCard label="محتوى جديد" value="—" hint="يُحدَّث عند الربط بالخادم" icon={BookOpen} />
      </AdminStatsGrid>
      <SectionCard title="مواعيد قريبة">
        <DataTable
          columns={[
            { key: 'when', label: 'الوقت' },
            { key: 'what', label: 'الحدث' },
            { key: 'course', label: 'الشهادة / المسار' },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
