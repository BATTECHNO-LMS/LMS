import { AlertTriangle, UserX, Bell, HeartPulse, Flag } from 'lucide-react';
import { UI_PERMISSION } from '../../constants/permissions.js';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import { PermissionGate } from '../../components/permissions/PermissionGate.jsx';
import { Button } from '../../components/common/Button.jsx';
import { useLocale } from '../../features/locale/index.js';
import { tr } from '../../utils/i18n.js';

export function RiskStudentsPage() {
  const P = UI_PERMISSION;
  const { locale } = useLocale();
  const isArabic = locale === 'ar';

  return (
    <div className="page page--dashboard page--instructor">
      <AdminPageHeader
        title={tr(isArabic, 'الطلبة المتعثرون', 'At-risk students')}
        description={tr(
          isArabic,
          'متابعة المتعلمين ذوي المخاطر الأكاديمية وفق مؤشرات النظام.',
          'Monitor learners with academic risk signals based on system indicators.'
        )}
      />
      <AdminFilterBar>
        <SearchInput
          placeholder={tr(isArabic, 'بحث بالاسم أو الدفعة', 'Search by name or cohort')}
          aria-label={tr(isArabic, 'بحث', 'Search')}
        />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={tr(isArabic, 'حالات نشطة', 'Active cases')} value="—" icon={AlertTriangle} />
        <StatCard label={tr(isArabic, 'يتطلب متابعة', 'Needs follow-up')} value="—" icon={UserX} />
        <StatCard label={tr(isArabic, 'تنبيهات جديدة', 'New alerts')} value="—" icon={Bell} />
        <StatCard label={tr(isArabic, 'مؤشرات صحة', 'Health indicators')} value="—" icon={HeartPulse} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'قائمة المتابعة', 'Follow-up list')}>
        <DataTable
          emptyTitle={tr(isArabic, 'لا توجد حالات متعثرة مسجّلة', 'No at-risk cases recorded')}
          emptyDescription={tr(
            isArabic,
            'ستُعرض الحالات عند تفعيل مؤشرات المخاطر الأكاديمية.',
            'Cases will appear here once academic risk indicators are enabled.'
          )}
          columns={[
            { key: 'learner', label: tr(isArabic, 'المتعلم', 'Learner') },
            { key: 'cohort', label: tr(isArabic, 'الدفعة', 'Cohort') },
            { key: 'reason', label: tr(isArabic, 'السبب', 'Reason') },
            {
              key: 'level',
              label: tr(isArabic, 'المستوى', 'Level'),
              render: () => <StatusBadge variant="danger">{tr(isArabic, 'مرتفع', 'High')}</StatusBadge>,
            },
            {
              key: 'actions',
              label: tr(isArabic, 'الإجراءات', 'Actions'),
              render: () => (
                <PermissionGate permission={P.canManageRiskStudents}>
                  <Button type="button" variant="outline">
                    <Flag size={18} aria-hidden /> {tr(isArabic, 'متابعة / تعليم', 'Follow up / Flag')}
                  </Button>
                </PermissionGate>
              ),
            },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
