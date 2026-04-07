import { ListChecks, ListTree, Scale } from 'lucide-react';
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

export function RubricsPage() {
  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader title="معايير التقييم" description="بناء وإدارة سلالم التقييم والمعايير الفرعية." />
      <AdminActionBar>
        <Button type="button" variant="primary">
          معيار جديد
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالمعيار" aria-label="بحث" />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="معايير معرّفة" value="—" icon={ListChecks} />
        <StatCard label="مستويات أداء" value="—" icon={ListTree} />
        <StatCard label="أوزان مرتبطة" value="—" icon={Scale} />
      </AdminStatsGrid>
      <SectionCard title="قائمة المعايير">
        <DataTable
          columns={[
            { key: 'name', label: 'المعيار' },
            { key: 'levels', label: 'عدد المستويات' },
            { key: 'linked', label: 'مرتبط بتقييمات' },
            { key: 'updated', label: 'آخر تحديث' },
            { key: 'actions', label: 'الإجراءات' },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
