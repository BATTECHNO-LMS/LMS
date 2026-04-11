import { useMemo } from 'react';
import { CalendarDays, Video, MapPin, Bell } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { useLocale } from '../../features/locale/index.js';
import { useTenant } from '../../features/tenant/index.js';
import { tr } from '../../utils/i18n.js';
import { STUDENT_SESSION_ROWS } from '../../mocks/lmsPageData.js';

export function StudentSessionsPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { filterRows, scopeId } = useTenant();
  const rows = useMemo(() => filterRows(STUDENT_SESSION_ROWS), [filterRows, scopeId]);

  const online = useMemo(() => rows.filter((r) => r.link === 'انضمام').length, [rows]);
  const onsite = useMemo(() => rows.filter((r) => r.link !== 'انضمام').length, [rows]);

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
        <StatCard label={tr(isArabic, 'هذا الأسبوع', 'This week')} value={String(rows.length)} icon={CalendarDays} />
        <StatCard label={tr(isArabic, 'عن بُعد', 'Online')} value={String(online)} icon={Video} />
        <StatCard label={tr(isArabic, 'حضوري', 'Onsite')} value={String(onsite)} icon={MapPin} />
        <StatCard label={tr(isArabic, 'تذكيرات', 'Reminders')} value={String(rows.length)} icon={Bell} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'الجلسات القادمة', 'Upcoming sessions')}>
        <DataTable
          emptyTitle={tr(isArabic, 'لا توجد جلسات', 'No sessions')}
          emptyDescription={tr(isArabic, 'لا توجد جلسات مطابقة.', 'No matching sessions.')}
          columns={[
            { key: 'when', label: tr(isArabic, 'الوقت', 'Time') },
            { key: 'title', label: tr(isArabic, 'العنوان', 'Title') },
            { key: 'course', label: tr(isArabic, 'المساق', 'Course') },
            { key: 'link', label: tr(isArabic, 'الرابط', 'Link') },
          ]}
          rows={rows}
        />
      </SectionCard>
    </div>
  );
}
