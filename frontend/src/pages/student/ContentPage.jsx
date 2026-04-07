import { BookOpen, PlayCircle, FileText, Layers } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';

export function ContentPage() {
  return (
    <div className="page page--dashboard page--student">
      <AdminPageHeader title="المحتوى" description="الوصول إلى الوحدات والمواد والموارد التعليمية لمساقاتك." />
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالعنوان أو الوحدة" aria-label="بحث" />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="وحدات متاحة" value="—" icon={Layers} />
        <StatCard label="دروس مرئية" value="—" icon={PlayCircle} />
        <StatCard label="مستندات" value="—" icon={FileText} />
        <StatCard label="مقروءة" value="—" icon={BookOpen} />
      </AdminStatsGrid>
      <SectionCard title="المحتوى حسب المساق">
        <DataTable
          columns={[
            { key: 'unit', label: 'الوحدة' },
            { key: 'type', label: 'النوع' },
            { key: 'duration', label: 'المدة' },
            { key: 'done', label: 'مكتمل' },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
