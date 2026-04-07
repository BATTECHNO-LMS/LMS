import { HeartPulse, ClipboardList, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  AdminPageHeader,
  AdminActionBar,
  AdminStatsGrid,
  SectionCard,
} from '../../components/admin/index.js';
import { Button } from '../../components/common/Button.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';

export function QAPage() {
  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader title="الجودة" description="لوحة مؤشرات الجودة والالتزام بالإجراءات." />
      <AdminActionBar>
        <Button type="button" variant="primary">
          خطة تحسين
        </Button>
        <Button type="button" variant="outline">
          تقرير ملخص
        </Button>
      </AdminActionBar>
      <AdminStatsGrid>
        <StatCard label="مؤشرات نشطة" value="—" icon={HeartPulse} />
        <StatCard label="مراجعات مفتوحة" value="—" icon={ClipboardList} />
        <StatCard label="تنبيهات" value="—" icon={AlertCircle} />
        <StatCard label="مغلقة هذا الشهر" value="—" icon={CheckCircle2} />
      </AdminStatsGrid>
      <SectionCard title="مؤشرات الجودة">
        <DataTable
          columns={[
            { key: 'name', label: 'المؤشر' },
            { key: 'owner', label: 'المسؤول' },
            { key: 'status', label: 'الحالة' },
            { key: 'due', label: 'الاستحقاق' },
            { key: 'actions', label: 'الإجراءات' },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
