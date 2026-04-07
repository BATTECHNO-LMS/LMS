import { Award, ShieldCheck, Download, QrCode } from 'lucide-react';
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

export function CertificatesPage() {
  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader title="الشهادات الرقمية" description="إصدار الشهادات والتحقق من صحتها." />
      <AdminActionBar>
        <Button type="button" variant="primary">
          إصدار دفعة
        </Button>
        <Button type="button" variant="outline">
          التحقق السريع
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالمتعلّم أو الرمز" aria-label="بحث" />
        <SelectField id="cert-status" label="الحالة" defaultValue="">
          <option value="">كل الحالات</option>
          <option value="issued">صادرة</option>
          <option value="revoked">ملغاة</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label="شهادات صادرة" value="—" icon={Award} />
        <StatCard label="موقّعة رقمياً" value="—" icon={ShieldCheck} />
        <StatCard label="تنزيلات" value="—" icon={Download} />
        <StatCard label="تحقق QR" value="—" icon={QrCode} />
      </AdminStatsGrid>
      <SectionCard title="سجل الشهادات">
        <DataTable
          columns={[
            { key: 'code', label: 'الرمز' },
            { key: 'learner', label: 'المتعلّم' },
            { key: 'credential', label: 'الشهادة' },
            { key: 'issued', label: 'تاريخ الإصدار' },
            { key: 'status', label: 'الحالة' },
            { key: 'actions', label: 'الإجراءات' },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
