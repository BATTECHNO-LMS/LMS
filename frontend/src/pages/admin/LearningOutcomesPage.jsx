import { ListTree, Target, BookMarked, Layers } from 'lucide-react';
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

export function LearningOutcomesPage() {
  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title="مخرجات التعلم"
        description="ربط مخرجات التعلم بالشهادات والمقاييس الأكاديمية."
      />
      <AdminActionBar>
        <Button type="button" variant="primary">
          مخرج جديد
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالرمز أو الوصف" aria-label="بحث" />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="مخرجات معرّفة" value="—" icon={ListTree} />
        <StatCard label="مرتبطة بشهادات" value="—" icon={BookMarked} />
        <StatCard label="مقاييس نشطة" value="—" icon={Target} />
        <StatCard label="دفعات مغطاة" value="—" icon={Layers} />
      </AdminStatsGrid>
      <SectionCard title="قائمة مخرجات التعلم">
        <DataTable
          columns={[
            { key: 'code', label: 'الرمز' },
            { key: 'title', label: 'الوصف' },
            { key: 'credential', label: 'الشهادة' },
            { key: 'status', label: 'الحالة' },
            { key: 'actions', label: 'الإجراءات' },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
