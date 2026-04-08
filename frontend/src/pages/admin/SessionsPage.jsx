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
import { tr } from '../../utils/i18n.js';

export function SessionsPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';

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
        <StatCard label={tr(isArabic, 'جلسات هذا الأسبوع', 'Sessions this week')} value="—" icon={CalendarDays} />
        <StatCard label={tr(isArabic, 'قادمة', 'Upcoming')} value="—" icon={Clock} />
        <StatCard label={tr(isArabic, 'مواقع', 'Locations')} value="—" icon={MapPin} />
        <StatCard label={tr(isArabic, 'جلسات مباشرة', 'Live sessions')} value="—" icon={Video} />
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
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
