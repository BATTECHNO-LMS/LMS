import { ShieldCheck, User, Calendar, Flag } from 'lucide-react';
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

export function QAReviewsPage() {
  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader title="مراجعات الجودة" description="جدولة ومتابعة جولات المراجعة الداخلية." />
      <AdminActionBar>
        <Button type="button" variant="primary">
          مراجعة جديدة
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالدفعة أو الوحدة" aria-label="بحث" />
        <SelectField id="qa-status" label="الحالة" defaultValue="">
          <option value="">كل الحالات</option>
          <option value="open">مفتوحة</option>
          <option value="closed">مغلقة</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="مراجعات مجدولة" value="—" icon={Calendar} />
        <StatCard label="مراجعون" value="—" icon={User} />
        <StatCard label="ملاحظات حرجة" value="—" icon={Flag} />
        <StatCard label="مكتملة" value="—" icon={ShieldCheck} />
      </AdminStatsGrid>
      <SectionCard title="قائمة المراجعات">
        <DataTable
          columns={[
            { key: 'title', label: 'المراجعة' },
            { key: 'scope', label: 'النطاق' },
            { key: 'lead', label: 'قائد المراجعة' },
            { key: 'status', label: 'الحالة' },
            { key: 'due', label: 'الاستحقاق' },
            { key: 'actions', label: 'الإجراءات' },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
