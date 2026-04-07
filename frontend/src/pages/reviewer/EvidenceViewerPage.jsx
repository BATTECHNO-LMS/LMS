import { FolderOpen, FileText, Image, Paperclip } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';

export function EvidenceViewerPage() {
  return (
    <div className="page page--dashboard page--reviewer">
      <AdminPageHeader title="الأدلة والمرفقات" description="استعراض الأدلة المؤسسية والمرفقات الداعمة لطلبات الاعتراف والتقارير." />
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالعنوان أو النوع" aria-label="بحث" />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="إجمالي العناصر" value="—" icon={FolderOpen} />
        <StatCard label="مستندات" value="—" icon={FileText} />
        <StatCard label="صور" value="—" icon={Image} />
        <StatCard label="مرفقات" value="—" icon={Paperclip} />
      </AdminStatsGrid>
      <SectionCard title="قائمة الأدلة">
        <DataTable
          columns={[
            { key: 'title', label: 'العنوان' },
            { key: 'category', label: 'التصنيف' },
            { key: 'size', label: 'الحجم' },
            { key: 'uploaded', label: 'الرفع' },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
