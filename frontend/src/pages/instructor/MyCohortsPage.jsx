import { Layers, Users, CalendarDays, ClipboardCheck } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';

export function MyCohortsPage() {
  return (
    <div className="page page--dashboard page--instructor">
      <AdminPageHeader title="دفعاتي" description="إدارة الدفعات التدريبية المرتبطة بحسابك ومتابعة تقدمها." />
      <AdminFilterBar>
        <SearchInput placeholder="بحث باسم الدفعة أو الشهادة" aria-label="بحث" />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="الدفعات النشطة" value="—" icon={Layers} />
        <StatCard label="إجمالي المتعلمين" value="—" icon={Users} />
        <StatCard label="جلسات هذا الأسبوع" value="—" icon={CalendarDays} />
        <StatCard label="مهام معلّقة" value="—" icon={ClipboardCheck} />
      </AdminStatsGrid>
      <SectionCard title="قائمة الدفعات">
        <DataTable
          columns={[
            { key: 'name', label: 'الدفعة' },
            { key: 'credential', label: 'الشهادة' },
            { key: 'learners', label: 'عدد المتعلمين' },
            {
              key: 'status',
              label: 'الحالة',
              render: () => <StatusBadge variant="info">قيد التنفيذ</StatusBadge>,
            },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
