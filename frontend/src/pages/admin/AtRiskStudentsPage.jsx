import { useMemo } from 'react';
import { AlertTriangle, UserX, TrendingDown, Users } from 'lucide-react';
import {
  AdminPageHeader,
  AdminFilterBar,
  AdminStatsGrid,
  SectionCard,
  SearchInput,
} from '../../components/admin/index.js';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { useLocale } from '../../features/locale/index.js';
import { useRiskCases } from '../../features/risks/index.js';
import { tr } from '../../utils/i18n.js';

const RISK_LEVEL_LABELS = {
  ar: { critical: 'حرج', high: 'مرتفع', medium: 'متوسط', low: 'منخفض' },
  en: { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' },
};

export function AtRiskStudentsPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const listParams = useMemo(
    () => ({ status: 'open' }),
    []
  );
  const { data, isLoading, isError, error, refetch } = useRiskCases(listParams, { staleTime: 30_000 });

  const cases = data?.risk_cases ?? [];

  const rows = useMemo(
    () =>
      cases.map((r) => ({
        id: r.id,
        learner: r.student?.full_name ?? r.student?.email ?? '—',
        cohort: r.cohort?.title ?? '—',
        indicator: r.risk_type ?? '—',
        tier: RISK_LEVEL_LABELS[isArabic ? 'ar' : 'en'][r.risk_level] ?? r.risk_level ?? '—',
        owner: r.opened_by_user?.full_name ?? '—',
      })),
    [cases, isArabic]
  );

  const highTier = cases.filter((r) => r.risk_level === 'high' || r.risk_level === 'critical').length;
  const mediumTier = cases.filter((r) => r.risk_level === 'medium').length;
  const lowTier = cases.filter((r) => r.risk_level === 'low').length;

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title={tr(isArabic, 'الطلبة المتعثرون', 'At-risk students')}
        description={tr(
          isArabic,
          'حالات المخاطر الأكاديمية المفتوحة من نظام إدارة المخاطر.',
          'Open academic risk cases from the risk management module.'
        )}
      />
      <AdminFilterBar>
        <SearchInput
          placeholder={tr(isArabic, 'بحث بالمتعلّم', 'Search learner')}
          aria-label={tr(isArabic, 'بحث', 'Search')}
          disabled
        />
      </AdminFilterBar>
      {isLoading ? (
        <LoadingSpinner />
      ) : isError ? (
        <EmptyState
          title={tr(isArabic, 'تعذّر تحميل البيانات', 'Failed to load data')}
          description={error?.message}
          actionLabel={tr(isArabic, 'إعادة المحاولة', 'Retry')}
          onAction={() => refetch()}
        />
      ) : (
        <>
          <AdminStatsGrid>
            <StatCard
              label={tr(isArabic, 'حالات نشطة', 'Active cases')}
              value={String(cases.length)}
              icon={AlertTriangle}
            />
            <StatCard
              label={tr(isArabic, 'مستوى مرتفع', 'High tier')}
              value={String(highTier)}
              icon={TrendingDown}
            />
            <StatCard
              label={tr(isArabic, 'مستوى متوسط', 'Medium tier')}
              value={String(mediumTier)}
              icon={Users}
            />
            <StatCard
              label={tr(isArabic, 'مستوى منخفض', 'Low tier')}
              value={String(lowTier)}
              icon={UserX}
            />
          </AdminStatsGrid>
          <SectionCard title={tr(isArabic, 'قائمة الطلبة', 'Students list')}>
            <DataTable
              emptyTitle={tr(isArabic, 'لا توجد حالات', 'No cases')}
              emptyDescription={tr(
                isArabic,
                'لا توجد حالات مخاطر مفتوحة ضمن نطاقك.',
                'No open risk cases in your scope.'
              )}
              columns={[
                { key: 'learner', label: tr(isArabic, 'المتعلّم', 'Learner') },
                { key: 'cohort', label: tr(isArabic, 'الدفعة', 'Cohort') },
                { key: 'indicator', label: tr(isArabic, 'المؤشر', 'Indicator') },
                { key: 'tier', label: tr(isArabic, 'المستوى', 'Tier') },
                { key: 'owner', label: tr(isArabic, 'المسؤول', 'Owner') },
              ]}
              rows={rows}
            />
          </SectionCard>
        </>
      )}
    </div>
  );
}
