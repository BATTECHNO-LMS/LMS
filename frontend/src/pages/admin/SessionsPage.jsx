import { useMemo } from 'react';
import { CalendarDays, Clock, MapPin, Video } from 'lucide-react';
import {
  AdminPageHeader,
  AdminActionBar,
  AdminFilterBar,
  AdminStatsGrid,
  SectionCard,
  SearchInput,
  SelectField,
} from '../../components/admin/index.js';
import { Button } from '../../components/common/Button.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { useLocale } from '../../features/locale/index.js';
import { useTenant } from '../../features/tenant/index.js';
import { tr } from '../../utils/i18n.js';
import { ADMIN_SESSIONS } from '../../mocks/lmsPageData.js';

export function SessionsPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { filterRows, scopeId } = useTenant();
  const rows = useMemo(() => filterRows(ADMIN_SESSIONS), [filterRows, scopeId]);
  const upcoming = useMemo(() => rows.filter((r) => r.status === 'مجدولة').length, [rows]);

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title={tr(isArabic, 'الجلسات', 'Sessions')}
        description={tr(isArabic, 'جداول الجلسات الحضورية والافتراضية.', 'Schedules for in-person and virtual sessions.')}
      />
      <AdminActionBar>
        <Button type="button" variant="primary">
          {tr(isArabic, 'جلسة جديدة', 'New session')}
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput
          placeholder={tr(isArabic, 'بحث بالجلسة', 'Search sessions')}
          aria-label={tr(isArabic, 'بحث', 'Search')}
        />
        <SelectField id="session-mode" label={tr(isArabic, 'النوع', 'Type')} defaultValue="">
          <option value="">{tr(isArabic, 'الكل', 'All')}</option>
          <option value="online">{tr(isArabic, 'عن بُعد', 'Remote')}</option>
          <option value="onsite">{tr(isArabic, 'حضوري', 'On-site')}</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={tr(isArabic, 'جلسات هذا الأسبوع', 'Sessions this week')} value={String(rows.length)} icon={CalendarDays} />
        <StatCard label={tr(isArabic, 'قادمة', 'Upcoming')} value={String(upcoming)} icon={Clock} />
        <StatCard label={tr(isArabic, 'مواقع', 'Locations')} value={String(rows.filter((r) => r.mode === 'حضوري' || r.mode === 'مختلط').length)} icon={MapPin} />
        <StatCard label={tr(isArabic, 'جلسات مباشرة', 'Live sessions')} value={String(rows.filter((r) => r.mode === 'عن بُعد').length)} icon={Video} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'قائمة الجلسات', 'Sessions list')}>
        <DataTable
          emptyTitle={tr(isArabic, 'لا توجد بيانات', 'No data')}
          emptyDescription={tr(isArabic, 'لم يتم العثور على سجلات.', 'No records found.')}
          columns={[
            { key: 'title', label: tr(isArabic, 'العنوان', 'Title') },
            { key: 'cohort', label: tr(isArabic, 'الدفعة', 'Cohort') },
            { key: 'start', label: tr(isArabic, 'البداية', 'Start') },
            { key: 'mode', label: tr(isArabic, 'النوع', 'Type') },
            { key: 'status', label: tr(isArabic, 'الحالة', 'Status') },
            { key: 'actions', label: tr(isArabic, 'الإجراءات', 'Actions') },
          ]}
          rows={rows}
        />
      </SectionCard>
    </div>
  );
}
