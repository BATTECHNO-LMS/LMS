import { CalendarDays, Video, MapPin, Bell } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { useLocale } from '../../features/locale/index.js';
import { tr } from '../../utils/i18n.js';

export function StudentSessionsPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';

  return (
    <div className="page page--dashboard page--student">
      <AdminPageHeader
        title={tr(isArabic, 'الجلسات', 'Sessions')}
        description={tr(
          isArabic,
          'جدول جلساتك الحضورية والافتراضية والروابط والتذكيرات.',
          'Your onsite and online sessions schedule with links and reminders.'
        )}
      />
      <AdminFilterBar>
        <SearchInput
          placeholder={tr(isArabic, 'بحث بالمساق أو التاريخ', 'Search by course or date')}
          aria-label={tr(isArabic, 'بحث', 'Search')}
        />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={tr(isArabic, 'هذا الأسبوع', 'This week')} value="—" icon={CalendarDays} />
        <StatCard label={tr(isArabic, 'عن بُعد', 'Online')} value="—" icon={Video} />
        <StatCard label={tr(isArabic, 'حضوري', 'Onsite')} value="—" icon={MapPin} />
        <StatCard label={tr(isArabic, 'تذكيرات', 'Reminders')} value="—" icon={Bell} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'الجلسات القادمة', 'Upcoming sessions')}>
        <DataTable
          columns={[
            { key: 'when', label: tr(isArabic, 'الوقت', 'Time') },
            { key: 'title', label: tr(isArabic, 'العنوان', 'Title') },
            { key: 'course', label: tr(isArabic, 'المساق', 'Course') },
            { key: 'link', label: tr(isArabic, 'الرابط', 'Link') },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
