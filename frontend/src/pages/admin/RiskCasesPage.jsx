import { AlertTriangle, TrendingUp, UserX, ShieldAlert } from 'lucide-react';
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

export function RiskCasesPage() {
  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader title="حالات المخاطر" description="تتبّع مخاطر الأداء الأكاديمي والتدخلات." />
      <AdminActionBar>
        <Button type="button" variant="primary">
          تسجيل حالة
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالمتعلّم" aria-label="بحث" />
        <SelectField id="risk-level" label="المستوى" defaultValue="">
          <option value="">كل المستويات</option>
          <option value="high">مرتفع</option>
          <option value="medium">متوسط</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="حالات مفتوحة" value="—" icon={AlertTriangle} />
        <StatCard label="متصاعدة" value="—" icon={TrendingUp} />
        <StatCard label="مغلقة" value="—" icon={ShieldAlert} />
        <StatCard label="متابعة نشطة" value="—" icon={UserX} />
      </AdminStatsGrid>
      <SectionCard title="قائمة الحالات">
        <DataTable
          columns={[
            { key: 'learner', label: 'المتعلّم' },
            { key: 'cohort', label: 'الدفعة' },
            { key: 'level', label: 'المستوى' },
            { key: 'owner', label: 'المسؤول' },
            { key: 'status', label: 'الحالة' },
            { key: 'actions', label: 'الإجراءات' },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
