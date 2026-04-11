import { useMemo } from 'react';
import { GraduationCap, BookMarked, Clock, CheckCircle2 } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import { useLocale } from '../../features/locale/index.js';
import { useTenant } from '../../features/tenant/index.js';
import { tr } from '../../utils/i18n.js';
import { STUDENT_PROGRAM_ROWS } from '../../mocks/lmsPageData.js';

function parseProgress(p) {
  const n = Number(String(p).replace(/%/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function MyProgramsPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { filterRows, scopeId } = useTenant();
  const rows = useMemo(() => filterRows(STUDENT_PROGRAM_ROWS), [filterRows, scopeId]);

  const avgProgress = useMemo(() => {
    if (rows.length === 0) return 0;
    const sum = rows.reduce((acc, r) => acc + parseProgress(r.progress), 0);
    return Math.round(sum / rows.length);
  }, [rows]);

  return (
    <div className="page page--dashboard page--student">
      <AdminPageHeader
        title={tr(isArabic, 'شهاداتي المسجل بها', 'My enrolled programs')}
        description={tr(
          isArabic,
          'عرض البرامج والشهادات التي سجّلت بها وتقدّمك في كل منها.',
          'Programs and credentials you are enrolled in and your progress in each.'
        )}
      />
      <AdminFilterBar>
        <SearchInput
          placeholder={tr(isArabic, 'بحث باسم البرنامج', 'Search by program name')}
          aria-label={tr(isArabic, 'بحث', 'Search')}
        />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={tr(isArabic, 'برامج نشطة', 'Active programs')} value={String(rows.length)} icon={GraduationCap} />
        <StatCard
          label={tr(isArabic, 'متوسط التقدم', 'Average progress')}
          value={`${avgProgress}%`}
          icon={CheckCircle2}
        />
        <StatCard label={tr(isArabic, 'وحدات بمسار', 'Units in track')} value={String(rows.length * 4)} icon={BookMarked} />
        <StatCard label={tr(isArabic, 'مواعيد قادمة', 'Upcoming deadlines')} value={String(rows.length + 2)} icon={Clock} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'قائمة التسجيلات', 'Enrollments')}>
        <DataTable
          emptyTitle={tr(isArabic, 'لا توجد تسجيلات', 'No enrollments')}
          emptyDescription={tr(isArabic, 'لم يتم العثور على برامج.', 'No programs found.')}
          columns={[
            { key: 'name', label: tr(isArabic, 'البرنامج / الشهادة', 'Program / credential') },
            { key: 'progress', label: tr(isArabic, 'التقدم', 'Progress') },
            { key: 'cohort', label: tr(isArabic, 'الدفعة', 'Cohort') },
            {
              key: 'status',
              label: tr(isArabic, 'الحالة', 'Status'),
              render: (row) => <StatusBadge variant="success">{row.status}</StatusBadge>,
            },
          ]}
          rows={rows}
        />
      </SectionCard>
    </div>
  );
}
