import { useMemo } from 'react';
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
import { useTenant } from '../../features/tenant/index.js';
import { useReport } from '../../features/reports/index.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

export function UniversityReportsPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { scopeId, isAllTenantsSelected } = useTenant();
  const params = useMemo(
    () => ({
      university_id: !isAllTenantsSelected && scopeId ? scopeId : undefined,
    }),
    [scopeId, isAllTenantsSelected]
  );
  const { data, isLoading, isError, error } = useReport('universities', params, { staleTime: 30_000 });
  const rows = data?.rows ?? [];
  const summary = data?.summary ?? {};

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
        <StatCard label={tr(isArabic, 'تقارير منشورة', 'Published reports')} value={String(summary.total_rows ?? rows.length)} icon={FileSpreadsheet} />
        <StatCard
          label={tr(isArabic, 'مؤشرات رئيسية', 'Key metrics')}
          value={String(rows.reduce((s, r) => s + Number(r.enrolled_students_count || 0), 0))}
          icon={BarChart3}
        />
        <StatCard
          label={tr(isArabic, 'اتجاهات', 'Trends')}
          value={String(rows.reduce((s, r) => s + Number(r.recognition_requests_count || 0), 0))}
          icon={LineChart}
        />
        <StatCard
          label={tr(isArabic, 'توزيع', 'Distribution')}
          value={String(rows.reduce((s, r) => s + Number(r.certificates_count || 0), 0))}
          icon={PieChart}
        />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'التقارير المتاحة', 'Available reports')}>
        {isLoading ? <p className="crud-muted">{tr(isArabic, 'جاري التحميل...', 'Loading...')}</p> : null}
        {isError ? <p className="crud-muted">{getApiErrorMessage(error, tr(isArabic, 'تعذر التحميل', 'Load failed'))}</p> : null}
        <DataTable
          columns={[
            { key: 'university_name', label: tr(isArabic, 'الجامعة', 'University') },
            { key: 'cohorts_count', label: tr(isArabic, 'الدفعات', 'Cohorts') },
            { key: 'enrolled_students_count', label: tr(isArabic, 'الطلبة', 'Students') },
            { key: 'recognition_requests_count', label: tr(isArabic, 'الاعتراف', 'Recognition') },
            { key: 'certificates_count', label: tr(isArabic, 'الشهادات', 'Certificates') },
          ]}
          rows={rows}
        />
      </SectionCard>
    </div>
  );
}
