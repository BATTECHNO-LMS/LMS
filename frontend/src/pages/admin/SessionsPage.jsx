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

export function SessionsPage() {
  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader title="الجلسات" description="جداول الجلسات الحضورية والافتراضية." />
      <AdminActionBar>
        <Button type="button" variant="primary">
          جلسة جديدة
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالجلسة" aria-label="بحث" />
        <SelectField id="session-mode" label="النوع" defaultValue="">
          <option value="">الكل</option>
          <option value="online">عن بُعد</option>
          <option value="onsite">حضوري</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="جلسات هذا الأسبوع" value="—" icon={CalendarDays} />
        <StatCard label="قادمة" value="—" icon={Clock} />
        <StatCard label="مواقع" value="—" icon={MapPin} />
        <StatCard label="جلسات مباشرة" value="—" icon={Video} />
      </AdminStatsGrid>
      <SectionCard title="قائمة الجلسات">
        <DataTable
          columns={[
            { key: 'title', label: 'العنوان' },
            { key: 'cohort', label: 'الدفعة' },
            { key: 'start', label: 'البداية' },
            { key: 'mode', label: 'النوع' },
            { key: 'status', label: 'الحالة' },
            { key: 'actions', label: 'الإجراءات' },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
