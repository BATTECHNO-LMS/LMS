import { Layers, Users, CalendarDays, ClipboardCheck } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import { useLocale } from '../../features/locale/index.js';
import { tr } from '../../utils/i18n.js';

export function MyCohortsPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';

  return (
    <div className="page page--dashboard page--instructor">
      <AdminPageHeader
        title={tr(isArabic, 'دفعاتي', 'My cohorts')}
        description={tr(
          isArabic,
          'إدارة الدفعات التدريبية المرتبطة بحسابك ومتابعة تقدمها.',
          'Manage your assigned training cohorts and track their progress.'
        )}
      />
      <AdminFilterBar>
        <SearchInput
          placeholder={tr(isArabic, 'بحث باسم الدفعة أو الشهادة', 'Search by cohort or credential')}
          aria-label={tr(isArabic, 'بحث', 'Search')}
        />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={tr(isArabic, 'الدفعات النشطة', 'Active cohorts')} value="—" icon={Layers} />
        <StatCard label={tr(isArabic, 'إجمالي المتعلمين', 'Total learners')} value="—" icon={Users} />
        <StatCard label={tr(isArabic, 'جلسات هذا الأسبوع', 'Sessions this week')} value="—" icon={CalendarDays} />
        <StatCard label={tr(isArabic, 'مهام معلّقة', 'Pending tasks')} value="—" icon={ClipboardCheck} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'قائمة الدفعات', 'Cohorts list')}>
        <DataTable
          columns={[
            { key: 'name', label: tr(isArabic, 'الدفعة', 'Cohort') },
            { key: 'credential', label: tr(isArabic, 'الشهادة', 'Credential') },
            { key: 'learners', label: tr(isArabic, 'عدد المتعلمين', 'Learners count') },
            {
              key: 'status',
              label: tr(isArabic, 'الحالة', 'Status'),
              render: () => <StatusBadge variant="info">{tr(isArabic, 'قيد التنفيذ', 'In progress')}</StatusBadge>,
            },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
