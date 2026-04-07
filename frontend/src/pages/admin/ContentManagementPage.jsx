import { BookOpen, FileText, Link2, Layers } from 'lucide-react';
import {
  AdminPageHeader,
  AdminActionBar,
  AdminFilterBar,
  AdminStatsGrid,
  SectionCard,
  SearchInput,
  SelectField,
} from '../../components/admin/index.js';
import { Button } from '../../components/common/Button.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';

export function ContentManagementPage() {
  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader title="المحتوى" description="إدارة الوحدات التعليمية والموارد المرتبطة بالدفعات." />
      <AdminActionBar>
        <Button type="button" variant="primary">
          وحدة جديدة
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالعنوان" aria-label="بحث" />
        <SelectField id="content-type" label="النوع" defaultValue="">
          <option value="">كل الأنواع</option>
          <option value="video">مرئي</option>
          <option value="doc">وثيقة</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="وحدات منشورة" value="—" icon={BookOpen} />
        <StatCard label="مسودات" value="—" icon={FileText} />
        <StatCard label="روابط خارجية" value="—" icon={Link2} />
        <StatCard label="مرتبطة بدفعات" value="—" icon={Layers} />
      </AdminStatsGrid>
      <SectionCard title="قائمة المحتوى">
        <DataTable
          columns={[
            { key: 'title', label: 'العنوان' },
            { key: 'type', label: 'النوع' },
            { key: 'cohort', label: 'الدفعة' },
            { key: 'status', label: 'الحالة' },
            { key: 'updated', label: 'آخر تحديث' },
            { key: 'actions', label: 'الإجراءات' },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
