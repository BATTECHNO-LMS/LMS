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

export function RiskStudentsPage() {
  const P = UI_PERMISSION;

  return (
    <div className="page page--dashboard page--instructor">
      <AdminPageHeader title="الطلبة المتعثرون" description="متابعة المتعلمين ذوي المخاطر الأكاديمية وفق مؤشرات النظام." />
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالاسم أو الدفعة" aria-label="بحث" />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="حالات نشطة" value="—" icon={AlertTriangle} />
        <StatCard label="يتطلب متابعة" value="—" icon={UserX} />
        <StatCard label="تنبيهات جديدة" value="—" icon={Bell} />
        <StatCard label="مؤشرات صحة" value="—" icon={HeartPulse} />
      </AdminStatsGrid>
      <SectionCard title="قائمة المتابعة">
        <DataTable
          emptyTitle="لا توجد حالات متعثرة مسجّلة"
          emptyDescription="ستُعرض الحالات عند تفعيل مؤشرات المخاطر الأكاديمية."
          columns={[
            { key: 'learner', label: 'المتعلم' },
            { key: 'cohort', label: 'الدفعة' },
            { key: 'reason', label: 'السبب' },
            {
              key: 'level',
              label: 'المستوى',
              render: () => <StatusBadge variant="danger">مرتفع</StatusBadge>,
            },
            {
              key: 'actions',
              label: 'الإجراءات',
              render: () => (
                <PermissionGate permission={P.canManageRiskStudents}>
                  <Button type="button" variant="outline">
                    <Flag size={18} aria-hidden /> متابعة / تعليم
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
