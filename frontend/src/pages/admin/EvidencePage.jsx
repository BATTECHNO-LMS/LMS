import { FolderOpen, Paperclip, Shield, Clock } from 'lucide-react';
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

export function EvidencePage() {
  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader title="الأدلة" description="أرشفة الأدلة والمرفقات المرتبطة بالدفعات والجودة." />
      <AdminActionBar>
        <Button type="button" variant="primary">
          رفع دليل
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالعنوان" aria-label="بحث" />
        <SelectField id="evidence-type" label="النوع" defaultValue="">
          <option value="">كل الأنواع</option>
          <option value="doc">وثيقة</option>
          <option value="media">وسائط</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="أدلة مؤرشفة" value="—" icon={FolderOpen} />
        <StatCard label="مرفقات حديثة" value="—" icon={Paperclip} />
        <StatCard label="مقيّمة" value="—" icon={Shield} />
        <StatCard label="بانتظار المراجعة" value="—" icon={Clock} />
      </AdminStatsGrid>
      <SectionCard title="قائمة الأدلة">
        <DataTable
          columns={[
            { key: 'title', label: 'العنوان' },
            { key: 'cohort', label: 'الدفعة' },
            { key: 'type', label: 'النوع' },
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
