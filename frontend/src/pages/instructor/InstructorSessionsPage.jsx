import { CalendarDays, Clock, MapPin, Video } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { useLocale } from '../../features/locale/index.js';
import { tr } from '../../utils/i18n.js';

export function InstructorSessionsPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';

  return (
    <div className="page page--dashboard page--instructor">
      <AdminPageHeader
        title={tr(isArabic, 'الجلسات', 'Sessions')}
        description={tr(
          isArabic,
          'جدول الجلسات الحضورية والافتراضية المرتبطة بدفعاتك.',
          'Schedule of onsite and online sessions linked to your cohorts.'
        )}
      />
      <AdminFilterBar>
        <SearchInput
          placeholder={tr(isArabic, 'بحث بالدفعة أو الموضوع', 'Search by cohort or topic')}
          aria-label={tr(isArabic, 'بحث', 'Search')}
        />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={tr(isArabic, 'جلسات اليوم', 'Today sessions')} value="—" icon={CalendarDays} />
        <StatCard label={tr(isArabic, 'قادمة', 'Upcoming')} value="—" icon={Clock} />
        <StatCard label={tr(isArabic, 'حضوري', 'Onsite')} value="—" icon={MapPin} />
        <StatCard label={tr(isArabic, 'عن بُعد', 'Online')} value="—" icon={Video} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'الجلسات القادمة', 'Upcoming sessions')}>
        <DataTable
          columns={[
            { key: 'when', label: tr(isArabic, 'التاريخ والوقت', 'Date and time') },
            { key: 'topic', label: tr(isArabic, 'الموضوع', 'Topic') },
            { key: 'cohort', label: tr(isArabic, 'الدفعة', 'Cohort') },
            { key: 'mode', label: tr(isArabic, 'النوع', 'Mode') },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
