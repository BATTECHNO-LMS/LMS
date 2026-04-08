import { BarChart3, FileSpreadsheet, LineChart, PieChart } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { SelectField } from '../../components/admin/SelectField.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { useLocale } from '../../features/locale/index.js';
import { tr } from '../../utils/i18n.js';

export function UniversityReportsPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';

  return (
    <div className="page page--dashboard page--reviewer">
      <AdminPageHeader
        title={tr(isArabic, 'تقارير الجامعة', 'University reports')}
        description={tr(
          isArabic,
          'عرض التقارير المؤسسية والمؤشرات المعتمدة للمراجعة الداخلية.',
          'View institutional reports and approved indicators for internal review.'
        )}
      />
      <AdminFilterBar>
        <SearchInput placeholder={tr(isArabic, 'بحث بالتقرير', 'Search reports')} aria-label={tr(isArabic, 'بحث', 'Search')} />
        <SelectField id="year" label={tr(isArabic, 'السنة', 'Year')} defaultValue="">
          <option value="">{tr(isArabic, 'كل السنوات', 'All years')}</option>
          <option value="2026">2026</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={tr(isArabic, 'تقارير منشورة', 'Published reports')} value="—" icon={FileSpreadsheet} />
        <StatCard label={tr(isArabic, 'مؤشرات رئيسية', 'Key metrics')} value="—" icon={BarChart3} />
        <StatCard label={tr(isArabic, 'اتجاهات', 'Trends')} value="—" icon={LineChart} />
        <StatCard label={tr(isArabic, 'توزيع', 'Distribution')} value="—" icon={PieChart} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'التقارير المتاحة', 'Available reports')}>
        <DataTable
          columns={[
            { key: 'name', label: tr(isArabic, 'التقرير', 'Report') },
            { key: 'period', label: tr(isArabic, 'الفترة', 'Period') },
            { key: 'updated', label: tr(isArabic, 'آخر تحديث', 'Last update') },
            { key: 'format', label: tr(isArabic, 'الصيغة', 'Format') },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
