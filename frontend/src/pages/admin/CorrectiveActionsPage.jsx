import { ClipboardList, AlertTriangle, Timer, CheckCircle2 } from 'lucide-react';
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

export function CorrectiveActionsPage() {
  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title="الإجراءات التصحيحية"
        description="متابعة خطط المعالجة والإغلاق بعد مراجعات الجودة."
      />
      <AdminActionBar>
        <Button type="button" variant="primary">
          إجراء جديد
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالوحدة" aria-label="بحث" />
        <SelectField id="ca-status" label="الحالة" defaultValue="">
          <option value="">كل الحالات</option>
          <option value="open">مفتوح</option>
          <option value="done">مكتمل</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="إجراءات مفتوحة" value="—" icon={AlertTriangle} />
        <StatCard label="متأخرة" value="—" icon={Timer} />
        <StatCard label="مغلقة" value="—" icon={CheckCircle2} />
        <StatCard label="خطط نشطة" value="—" icon={ClipboardList} />
      </AdminStatsGrid>
      <SectionCard title="قائمة الإجراءات التصحيحية">
        <DataTable
          columns={[
            { key: 'id', label: 'المرجع' },
            { key: 'issue', label: 'الملاحظة' },
            { key: 'owner', label: 'المسؤول' },
            { key: 'due', label: 'الاستحقاق' },
            { key: 'status', label: 'الحالة' },
            { key: 'actions', label: 'الإجراءات' },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
