import { useMemo } from 'react';
import { Shield, KeyRound, Link2, Users } from 'lucide-react';
import {
  AdminPageHeader,
  AdminStatsGrid,
  SectionCard,
} from '../../components/admin/index.js';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { useLocale } from '../../features/locale/index.js';
import { useRolesOverview } from '../../features/roles/index.js';
import { tr } from '../../utils/i18n.js';

export function RolesPermissionsPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { data, isLoading, isError, error, refetch } = useRolesOverview();

  const summary = data?.summary;
  const rows = useMemo(() => {
    const roles = data?.roles ?? [];
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      scope: r.scope,
      users: String(r.users_count ?? 0),
      permissions: String(r.permissions_count ?? 0),
      updated: r.updated_at ? new Date(r.updated_at).toLocaleString(locale) : '—',
    }));
  }, [data, locale]);

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title={tr(isArabic, 'الأدوار والصلاحيات', 'Roles and permissions')}
        description={tr(
          isArabic,
          'عرض الأدوار والصلاحيات المعرّفة في النظام (قراءة فقط).',
          'View roles and permissions defined in the system (read-only).'
        )}
      />
      {isLoading ? (
        <LoadingSpinner />
      ) : isError ? (
        <EmptyState
          title={tr(isArabic, 'تعذّر تحميل البيانات', 'Failed to load data')}
          description={error?.message || tr(isArabic, 'حاول مرة أخرى.', 'Please try again.')}
          actionLabel={tr(isArabic, 'إعادة المحاولة', 'Retry')}
          onAction={() => refetch()}
        />
      ) : (
        <>
          <AdminStatsGrid>
            <StatCard
              label={tr(isArabic, 'الأدوار المعرّفة', 'Defined roles')}
              value={String(summary?.roles_count ?? 0)}
              icon={Shield}
            />
            <StatCard
              label={tr(isArabic, 'صلاحيات نشطة', 'Active permissions')}
              value={String(summary?.permissions_count ?? 0)}
              icon={KeyRound}
            />
            <StatCard
              label={tr(isArabic, 'روابط دور-صلاحية', 'Role-permission links')}
              value={String(summary?.role_permission_links ?? 0)}
              icon={Link2}
            />
            <StatCard
              label={tr(isArabic, 'مستخدمون مرتبطون', 'Linked users')}
              value={String(summary?.users_with_roles ?? 0)}
              icon={Users}
            />
          </AdminStatsGrid>
          <SectionCard title={tr(isArabic, 'الأدوار', 'Roles')}>
            <DataTable
              emptyTitle={tr(isArabic, 'لا توجد أدوار', 'No roles')}
              emptyDescription={tr(isArabic, 'لم يتم العثور على أدوار في قاعدة البيانات.', 'No roles found in the database.')}
              columns={[
                { key: 'name', label: tr(isArabic, 'الدور', 'Role') },
                { key: 'scope', label: tr(isArabic, 'النطاق', 'Scope') },
                { key: 'users', label: tr(isArabic, 'عدد المستخدمين', 'Users count') },
                { key: 'permissions', label: tr(isArabic, 'الصلاحيات', 'Permissions') },
                { key: 'updated', label: tr(isArabic, 'آخر تحديث', 'Last update') },
              ]}
              rows={rows}
            />
          </SectionCard>
        </>
      )}
    </div>
  );
}
