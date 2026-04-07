import { BadgeAlert, Gavel, Lock, Eye } from 'lucide-react';
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

export function IntegrityCasesPage() {
  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title="النزاهة الأكاديمية"
        description="إدارة قضايا النزاهة والتحقيقات المرتبطة بالشواهد."
      />
      <AdminActionBar>
        <Button type="button" variant="primary">
          قضية جديدة
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالمرجع" aria-label="بحث" />
        <SelectField id="int-status" label="الحالة" defaultValue="">
          <option value="">كل الحالات</option>
          <option value="open">مفتوحة</option>
          <option value="closed">مغلقة</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="قضايا مفتوحة" value="—" icon={BadgeAlert} />
        <StatCard label="قيد التحقيق" value="—" icon={Eye} />
        <StatCard label="قرارات" value="—" icon={Gavel} />
        <StatCard label="مؤرشفة" value="—" icon={Lock} />
      </AdminStatsGrid>
      <SectionCard title="قائمة القضايا">
        <DataTable
          columns={[
            { key: 'ref', label: 'المرجع' },
            { key: 'type', label: 'النوع' },
            { key: 'party', label: 'الجهة' },
            { key: 'status', label: 'الحالة' },
            { key: 'updated', label: 'آخر تحديث' },
            { key: 'actions', label: 'الإجراءات' },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
