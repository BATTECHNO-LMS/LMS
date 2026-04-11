import { useMemo } from 'react';
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
import { useLocale } from '../../features/locale/index.js';
import { useTenant } from '../../features/tenant/index.js';
import { tr } from '../../utils/i18n.js';
import { ADMIN_CERTIFICATES } from '../../mocks/lmsPageData.js';

export function CertificatesPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { filterRows, scopeId } = useTenant();
  const rows = useMemo(() => filterRows(ADMIN_CERTIFICATES), [filterRows, scopeId]);
  const issued = useMemo(() => rows.filter((r) => r.status === 'صادرة').length, [rows]);

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title={tr(isArabic, 'الشهادات الرقمية', 'Digital certificates')}
        description={tr(isArabic, 'إصدار الشهادات والتحقق من صحتها.', 'Issue certificates and verify authenticity.')}
      />
      <AdminActionBar>
        <Button type="button" variant="primary">
          {tr(isArabic, 'إصدار دفعة', 'Issue batch')}
        </Button>
        <Button type="button" variant="outline">
          {tr(isArabic, 'التحقق السريع', 'Quick verify')}
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput
          placeholder={tr(isArabic, 'بحث بالمتعلّم أو الرمز', 'Search by learner or code')}
          aria-label={tr(isArabic, 'بحث', 'Search')}
        />
        <SelectField id="cert-status" label={tr(isArabic, 'الحالة', 'Status')} defaultValue="">
          <option value="">{tr(isArabic, 'كل الحالات', 'All statuses')}</option>
          <option value="issued">{tr(isArabic, 'صادرة', 'Issued')}</option>
          <option value="revoked">{tr(isArabic, 'ملغاة', 'Revoked')}</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={tr(isArabic, 'شهادات صادرة', 'Issued certificates')} value={String(issued)} icon={Award} />
        <StatCard label={tr(isArabic, 'موقّعة رقمياً', 'Digitally signed')} value={String(issued)} icon={ShieldCheck} />
        <StatCard label={tr(isArabic, 'تنزيلات', 'Downloads')} value={String(rows.length * 3)} icon={Download} />
        <StatCard label={tr(isArabic, 'تحقق QR', 'QR verification')} value={String(rows.length * 2)} icon={QrCode} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'سجل الشهادات', 'Certificate log')}>
        <DataTable
          emptyTitle={tr(isArabic, 'لا توجد بيانات', 'No data')}
          emptyDescription={tr(isArabic, 'لم يتم العثور على سجلات.', 'No records found.')}
          columns={[
            { key: 'code', label: tr(isArabic, 'الرمز', 'Code') },
            { key: 'learner', label: tr(isArabic, 'المتعلّم', 'Learner') },
            { key: 'credential', label: tr(isArabic, 'الشهادة', 'Certificate') },
            { key: 'issued', label: tr(isArabic, 'تاريخ الإصدار', 'Issue date') },
            { key: 'status', label: tr(isArabic, 'الحالة', 'Status') },
            { key: 'actions', label: tr(isArabic, 'الإجراءات', 'Actions') },
          ]}
          rows={rows}
        />
      </SectionCard>
    </div>
  );
}
