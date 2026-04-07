import { ScrollText, User, Monitor, Filter } from 'lucide-react';
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

export function AuditLogsPage() {
  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader title="سجل التدقيق" description="سجل العمليات الحساسة والوصول للبيانات." />
      <AdminActionBar>
        <Button type="button" variant="primary">
          تصدير السجل
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالحدث أو المستخدم" aria-label="بحث" />
        <SelectField id="audit-level" label="الخطورة" defaultValue="">
          <option value="">كل المستويات</option>
          <option value="high">مرتفع</option>
          <option value="low">منخفض</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="أحداث اليوم" value="—" icon={ScrollText} />
        <StatCard label="مستخدمون فريدون" value="—" icon={User} />
        <StatCard label="مصادر" value="—" icon={Monitor} />
        <StatCard label="مرشّحات نشطة" value="—" icon={Filter} />
      </AdminStatsGrid>
      <SectionCard title="السجل">
        <DataTable
          columns={[
            { key: 'time', label: 'الوقت' },
            { key: 'actor', label: 'المستخدم' },
            { key: 'action', label: 'الحدث' },
            { key: 'resource', label: 'المورد' },
            { key: 'ip', label: 'المصدر' },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
