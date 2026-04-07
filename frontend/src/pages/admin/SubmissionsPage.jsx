import { Upload, Inbox, Clock, CheckCircle2 } from 'lucide-react';
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

export function SubmissionsPage() {
  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader title="التسليمات" description="متابعة تسليمات المتعلّمين وحالات التصحيح." />
      <AdminActionBar>
        <Button type="button" variant="primary">
          تصدير
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالمتعلّم" aria-label="بحث" />
        <SelectField id="sub-status" label="الحالة" defaultValue="">
          <option value="">كل الحالات</option>
          <option value="pending">بانتظار التصحيح</option>
          <option value="graded">مُصحَّح</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="تسليمات جديدة" value="—" icon={Inbox} />
        <StatCard label="بانتظار التصحيح" value="—" icon={Clock} />
        <StatCard label="مكتملة" value="—" icon={CheckCircle2} />
        <StatCard label="مرفوعات" value="—" icon={Upload} />
      </AdminStatsGrid>
      <SectionCard title="قائمة التسليمات">
        <DataTable
          columns={[
            { key: 'learner', label: 'المتعلّم' },
            { key: 'task', label: 'المهمة' },
            { key: 'submitted', label: 'تاريخ التسليم' },
            { key: 'status', label: 'الحالة' },
            { key: 'actions', label: 'الإجراءات' },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
