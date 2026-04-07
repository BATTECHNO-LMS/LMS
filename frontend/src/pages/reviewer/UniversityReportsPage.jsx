import { BarChart3, FileSpreadsheet, LineChart, PieChart } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { SelectField } from '../../components/admin/SelectField.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';

export function UniversityReportsPage() {
  return (
    <div className="page page--dashboard page--reviewer">
      <AdminPageHeader title="تقارير الجامعة" description="عرض التقارير المؤسسية والمؤشرات المعتمدة للمراجعة الداخلية." />
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالتقرير" aria-label="بحث" />
        <SelectField id="year" label="السنة" defaultValue="">
          <option value="">كل السنوات</option>
          <option value="2026">2026</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="تقارير منشورة" value="—" icon={FileSpreadsheet} />
        <StatCard label="مؤشرات رئيسية" value="—" icon={BarChart3} />
        <StatCard label="اتجاهات" value="—" icon={LineChart} />
        <StatCard label="توزيع" value="—" icon={PieChart} />
      </AdminStatsGrid>
      <SectionCard title="التقارير المتاحة">
        <DataTable
          columns={[
            { key: 'name', label: 'التقرير' },
            { key: 'period', label: 'الفترة' },
            { key: 'updated', label: 'آخر تحديث' },
            { key: 'format', label: 'الصيغة' },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
