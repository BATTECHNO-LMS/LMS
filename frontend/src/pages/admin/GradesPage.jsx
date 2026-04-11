import { useMemo } from 'react';
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
import { useLocale } from '../../features/locale/index.js';
import { useTenant } from '../../features/tenant/index.js';
import { tr } from '../../utils/i18n.js';
import { ADMIN_GRADES } from '../../mocks/lmsPageData.js';

export function GradesPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { filterRows, scopeId } = useTenant();
  const rows = useMemo(() => filterRows(ADMIN_GRADES), [filterRows, scopeId]);
  const avg = useMemo(() => {
    const nums = rows.map((r) => parseFloat(r.score, 10)).filter((n) => !Number.isNaN(n));
    if (!nums.length) return '—';
    return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1);
  }, [rows]);
  const pass = useMemo(() => rows.filter((r) => parseFloat(r.score, 10) >= 60).length, [rows]);

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title={tr(isArabic, 'الدرجات', 'Grades')}
        description={tr(isArabic, 'لوحة الدرجات والتوزيعات على مستوى الدفعات.', 'Grade board and distributions by cohort.')}
      />
      <AdminActionBar>
        <Button type="button" variant="primary">
          {tr(isArabic, 'تصدير درجات', 'Export grades')}
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput
          placeholder={tr(isArabic, 'بحث بالمتعلّم', 'Search learner')}
          aria-label={tr(isArabic, 'بحث', 'Search')}
        />
        <SelectField id="grade-cohort" label={tr(isArabic, 'الدفعة', 'Cohort')} defaultValue="">
          <option value="">{tr(isArabic, 'كل الدفعات', 'All cohorts')}</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={tr(isArabic, 'متوسط عام', 'Overall average')} value={String(avg)} icon={Sigma} />
        <StatCard label={tr(isArabic, 'نسبة النجاح', 'Pass rate')} value={rows.length ? `${Math.round((pass / rows.length) * 100)}%` : '—'} icon={TrendingUp} />
        <StatCard label={tr(isArabic, 'طلاب مكشوفون', 'Students covered')} value={String(rows.length)} icon={Users} />
        <StatCard label={tr(isArabic, 'عناصر تقييم', 'Assessment items')} value={String(rows.length)} icon={BarChart3} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'ملخص الدرجات', 'Grade summary')}>
        <DataTable
          emptyTitle={tr(isArabic, 'لا توجد بيانات', 'No data')}
          emptyDescription={tr(isArabic, 'لم يتم العثور على سجلات.', 'No records found.')}
          columns={[
            { key: 'learner', label: tr(isArabic, 'المتعلّم', 'Learner') },
            { key: 'cohort', label: tr(isArabic, 'الدفعة', 'Cohort') },
            { key: 'score', label: tr(isArabic, 'الدرجة', 'Score') },
            { key: 'grade', label: tr(isArabic, 'التقدير', 'Letter grade') },
            { key: 'updated', label: tr(isArabic, 'آخر تحديث', 'Last update') },
            { key: 'actions', label: tr(isArabic, 'الإجراءات', 'Actions') },
          ]}
          rows={rows}
        />
      </SectionCard>
    </div>
  );
}
