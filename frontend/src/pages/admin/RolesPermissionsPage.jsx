import { Shield, KeyRound, Lock, Users } from 'lucide-react';
import {
  AdminPageHeader,
  AdminActionBar,
  AdminFilterBar,
  AdminStatsGrid,
  SectionCard,
  SearchInput,
} from '../../components/admin/index.js';
import { Button } from '../../components/common/Button.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { useLocale } from '../../features/locale/index.js';
import { tr } from '../../utils/i18n.js';

export function RolesPermissionsPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title={tr(isArabic, 'الأدوار والصلاحيات', 'Roles and permissions')}
        description={tr(
          isArabic,
          'تعريف الأدوار، صلاحيات الوحدات، وسياسات الوصول.',
          'Define roles, module permissions, and access policies.'
        )}
      />
      <AdminActionBar>
        <Button type="button" variant="primary">
          {tr(isArabic, 'دور جديد', 'New role')}
        </Button>
        <Button type="button" variant="outline">
          {tr(isArabic, 'قالب صلاحيات', 'Permissions template')}
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput
          placeholder={tr(isArabic, 'بحث باسم الدور', 'Search by role name')}
          aria-label={tr(isArabic, 'بحث', 'Search')}
        />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={tr(isArabic, 'الأدوار المعرّفة', 'Defined roles')} value="—" icon={Shield} />
        <StatCard label={tr(isArabic, 'صلاحيات نشطة', 'Active permissions')} value="—" icon={KeyRound} />
        <StatCard label={tr(isArabic, 'سياسات مقفلة', 'Locked policies')} value="—" icon={Lock} />
        <StatCard label={tr(isArabic, 'مستخدمون مرتبطون', 'Linked users')} value="—" icon={Users} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'الأدوار', 'Roles')}>
        <DataTable
          emptyTitle={tr(isArabic, 'لا توجد بيانات', 'No data')}
          emptyDescription={tr(isArabic, 'لم يتم العثور على سجلات.', 'No records found.')}
          columns={[
            { key: 'name', label: tr(isArabic, 'الدور', 'Role') },
            { key: 'scope', label: tr(isArabic, 'النطاق', 'Scope') },
            { key: 'users', label: tr(isArabic, 'عدد المستخدمين', 'Users count') },
            { key: 'updated', label: tr(isArabic, 'آخر تحديث', 'Last update') },
            { key: 'actions', label: tr(isArabic, 'الإجراءات', 'Actions') },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
