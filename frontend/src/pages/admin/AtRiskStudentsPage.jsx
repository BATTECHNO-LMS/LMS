import { AlertTriangle, UserX, TrendingDown, Users } from 'lucide-react';
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

export function AtRiskStudentsPage() {
  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title="الطلبة المتعثرون"
        description="متابعة المتعلّمين ذوي المؤشرات الأكاديمية المنخفضة."
      />
      <AdminActionBar>
        <Button type="button" variant="primary">
          تصدير قائمة
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالمتعلّم" aria-label="بحث" />
        <SelectField id="risk-tier" label="المستوى" defaultValue="">
          <option value="">كل المستويات</option>
          <option value="high">مرتفع</option>
          <option value="medium">متوسط</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="حالات نشطة" value="—" icon={AlertTriangle} />
        <StatCard label="معدّل التحسّن" value="—" icon={TrendingDown} />
        <StatCard label="متابعة وقائية" value="—" icon={Users} />
        <StatCard label="مغلقة" value="—" icon={UserX} />
      </AdminStatsGrid>
      <SectionCard title="قائمة الطلبة">
        <DataTable
          columns={[
            { key: 'learner', label: 'المتعلّم' },
            { key: 'cohort', label: 'الدفعة' },
            { key: 'indicator', label: 'المؤشر' },
            { key: 'tier', label: 'المستوى' },
            { key: 'owner', label: 'المسؤول' },
            { key: 'actions', label: 'الإجراءات' },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
