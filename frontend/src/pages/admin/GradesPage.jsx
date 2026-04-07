import { BarChart3, Sigma, TrendingUp, Users } from 'lucide-react';
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

export function GradesPage() {
  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader title="الدرجات" description="لوحة الدرجات والتوزيعات على مستوى الدفعات." />
      <AdminActionBar>
        <Button type="button" variant="primary">
          تصدير درجات
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالمتعلّم" aria-label="بحث" />
        <SelectField id="grade-cohort" label="الدفعة" defaultValue="">
          <option value="">كل الدفعات</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="متوسط عام" value="—" icon={Sigma} />
        <StatCard label="نسبة النجاح" value="—" icon={TrendingUp} />
        <StatCard label="طلاب مكشوفون" value="—" icon={Users} />
        <StatCard label="عناصر تقييم" value="—" icon={BarChart3} />
      </AdminStatsGrid>
      <SectionCard title="ملخص الدرجات">
        <DataTable
          columns={[
            { key: 'learner', label: 'المتعلّم' },
            { key: 'cohort', label: 'الدفعة' },
            { key: 'score', label: 'الدرجة' },
            { key: 'grade', label: 'التقدير' },
            { key: 'updated', label: 'آخر تحديث' },
            { key: 'actions', label: 'الإجراءات' },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
