import { useMemo } from 'react';
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
import { useLocale } from '../../features/locale/index.js';
import { useTenant } from '../../features/tenant/index.js';
import { tr } from '../../utils/i18n.js';
export function AtRiskStudentsPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { filterRows, scopeId } = useTenant();
  const rows = useMemo(() => filterRows([]), [filterRows, scopeId]);

  const highTier = useMemo(() => rows.filter((r) => r.tier === 'مرتفع').length, [rows]);
  const mediumTier = useMemo(() => rows.filter((r) => r.tier === 'متوسط').length, [rows]);
  const lowTier = useMemo(() => rows.filter((r) => r.tier === 'منخفض').length, [rows]);

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title={tr(isArabic, 'الطلبة المتعثرون', 'At-risk students')}
        description={tr(
          isArabic,
          'متابعة المتعلّمين ذوي المؤشرات الأكاديمية المنخفضة.',
          'Follow learners with low academic indicators.'
        )}
      />
      <AdminActionBar>
        <Button type="button" variant="primary">
          {tr(isArabic, 'تصدير قائمة', 'Export list')}
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput
          placeholder={tr(isArabic, 'بحث بالمتعلّم', 'Search learner')}
          aria-label={tr(isArabic, 'بحث', 'Search')}
        />
        <SelectField id="risk-tier" label={tr(isArabic, 'المستوى', 'Tier')} defaultValue="">
          <option value="">{tr(isArabic, 'كل المستويات', 'All levels')}</option>
          <option value="high">{tr(isArabic, 'مرتفع', 'High')}</option>
          <option value="medium">{tr(isArabic, 'متوسط', 'Medium')}</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={tr(isArabic, 'حالات نشطة', 'Active cases')} value={String(rows.length)} icon={AlertTriangle} />
        <StatCard label={tr(isArabic, 'مستوى مرتفع', 'High tier')} value={String(highTier)} icon={TrendingDown} />
        <StatCard label={tr(isArabic, 'مستوى متوسط', 'Medium tier')} value={String(mediumTier)} icon={Users} />
        <StatCard label={tr(isArabic, 'مستوى منخفض', 'Low tier')} value={String(lowTier)} icon={UserX} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'قائمة الطلبة', 'Students list')}>
        <DataTable
          emptyTitle={tr(isArabic, 'لا توجد بيانات', 'No data')}
          emptyDescription={tr(isArabic, 'لم يتم العثور على سجلات.', 'No records found.')}
          columns={[
            { key: 'learner', label: tr(isArabic, 'المتعلّم', 'Learner') },
            { key: 'cohort', label: tr(isArabic, 'الدفعة', 'Cohort') },
            { key: 'indicator', label: tr(isArabic, 'المؤشر', 'Indicator') },
            { key: 'tier', label: tr(isArabic, 'المستوى', 'Tier') },
            { key: 'owner', label: tr(isArabic, 'المسؤول', 'Owner') },
            { key: 'actions', label: tr(isArabic, 'الإجراءات', 'Actions') },
          ]}
          rows={rows}
        />
      </SectionCard>
    </div>
  );
}
