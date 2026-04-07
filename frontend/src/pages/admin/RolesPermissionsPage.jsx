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

export function RolesPermissionsPage() {
  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title="الأدوار والصلاحيات"
        description="تعريف الأدوار، صلاحيات الوحدات، وسياسات الوصول."
      />
      <AdminActionBar>
        <Button type="button" variant="primary">
          دور جديد
        </Button>
        <Button type="button" variant="outline">
          قالب صلاحيات
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput placeholder="بحث باسم الدور" aria-label="بحث" />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="الأدوار المعرّفة" value="—" icon={Shield} />
        <StatCard label="صلاحيات نشطة" value="—" icon={KeyRound} />
        <StatCard label="سياسات مقفلة" value="—" icon={Lock} />
        <StatCard label="مستخدمون مرتبطون" value="—" icon={Users} />
      </AdminStatsGrid>
      <SectionCard title="الأدوار">
        <DataTable
          columns={[
            { key: 'name', label: 'الدور' },
            { key: 'scope', label: 'النطاق' },
            { key: 'users', label: 'عدد المستخدمين' },
            { key: 'updated', label: 'آخر تحديث' },
            { key: 'actions', label: 'الإجراءات' },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
