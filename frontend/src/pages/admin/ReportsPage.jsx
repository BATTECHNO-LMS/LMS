import { FileSpreadsheet, Download, LineChart, PieChart } from 'lucide-react';
import {
  AdminPageHeader,
  AdminActionBar,
  AdminStatsGrid,
  SectionCard,
} from '../../components/admin/index.js';
import { Button } from '../../components/common/Button.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';

export function ReportsPage() {
  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader title="التقارير" description="تقارير تشغيلية وأكاديمية قابلة للتصدير." />
      <AdminActionBar>
        <Button type="button" variant="primary">
          <Download size={18} aria-hidden /> تصدير سريع
        </Button>
        <Button type="button" variant="outline">
          جدولة تقرير
        </Button>
      </AdminActionBar>
      <AdminStatsGrid>
        <StatCard label="تقارير جاهزة" value="—" icon={FileSpreadsheet} />
        <StatCard label="تصديرات اليوم" value="—" icon={Download} />
        <StatCard label="مؤشرات اتجاه" value="—" icon={LineChart} />
        <StatCard label="توزيعات" value="—" icon={PieChart} />
      </AdminStatsGrid>
      <SectionCard title="تقارير مقترحة">
        <DataTable
          columns={[
            { key: 'name', label: 'التقرير' },
            { key: 'audience', label: 'الجمهور' },
            { key: 'frequency', label: 'التكرار' },
            { key: 'last', label: 'آخر تشغيل' },
            { key: 'actions', label: 'الإجراءات' },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
