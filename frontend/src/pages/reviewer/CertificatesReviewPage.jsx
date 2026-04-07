import { Award, ShieldCheck, Link2, History } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';

export function CertificatesReviewPage() {
  return (
    <div className="page page--dashboard page--reviewer">
      <AdminPageHeader title="الشهادات المرتبطة" description="مراجعة الشهادات المرتبطة بالبرامج المعتمدة وحالات الربط مع المنصة." />
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالبرنامج أو المرجع" aria-label="بحث" />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="شهادات نشطة" value="—" icon={Award} />
        <StatCard label="معتمدة" value="—" icon={ShieldCheck} />
        <StatCard label="روابط تحقق" value="—" icon={Link2} />
        <StatCard label="سجل التحديثات" value="—" icon={History} />
      </AdminStatsGrid>
      <SectionCard title="قائمة الشهادات">
        <DataTable
          columns={[
            { key: 'program', label: 'البرنامج' },
            { key: 'issuer', label: 'الجهة' },
            { key: 'valid', label: 'الصلاحية' },
            {
              key: 'status',
              label: 'الحالة',
              render: () => <StatusBadge variant="success">معتمد</StatusBadge>,
            },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
