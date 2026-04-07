import { ClipboardCheck, UserCheck, UserX, Percent } from 'lucide-react';
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

export function AttendancePage() {
  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader title="الحضور" description="متابعة الحضور والغياب على مستوى الجلسات والدفعات." />
      <AdminActionBar>
        <Button type="button" variant="primary">
          تصدير تقرير
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالمتعلّم" aria-label="بحث" />
        <SelectField id="att-cohort" label="الدفعة" defaultValue="">
          <option value="">كل الدفعات</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="متوسط الحضور" value="—" icon={Percent} />
        <StatCard label="حضور مؤكد" value="—" icon={UserCheck} />
        <StatCard label="غياب مسجّل" value="—" icon={UserX} />
        <StatCard label="جلسات مغطاة" value="—" icon={ClipboardCheck} />
      </AdminStatsGrid>
      <SectionCard title="سجل الحضور">
        <DataTable
          columns={[
            { key: 'learner', label: 'المتعلّم' },
            { key: 'session', label: 'الجلسة' },
            { key: 'status', label: 'الحالة' },
            { key: 'time', label: 'الوقت' },
            { key: 'actions', label: 'الإجراءات' },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
