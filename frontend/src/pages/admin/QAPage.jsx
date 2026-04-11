import { useMemo } from 'react';
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
import { useLocale } from '../../features/locale/index.js';
import { useTenant } from '../../features/tenant/index.js';
import { tr } from '../../utils/i18n.js';
import { ADMIN_QA_INDICATORS, ADMIN_QA_REVIEWS } from '../../mocks/lmsPageData.js';

export function QAPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { filterRows, scopeId } = useTenant();
  const rows = useMemo(() => filterRows(ADMIN_QA_INDICATORS), [filterRows, scopeId]);
  const reviews = useMemo(() => filterRows(ADMIN_QA_REVIEWS), [filterRows, scopeId]);

  const openReviews = useMemo(
    () => reviews.filter((r) => r.status === 'مفتوحة' || r.status === 'مجدولة' || r.status === 'قيد التحضير').length,
    [reviews]
  );
  const alerts = useMemo(
    () => rows.filter((r) => r.status === 'يحتاج متابعة' || r.status === 'قيد المراجعة').length,
    [rows]
  );
  const closedMonth = useMemo(() => reviews.filter((r) => r.status === 'مغلقة').length, [reviews]);

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title={tr(isArabic, 'الجودة', 'Quality assurance')}
        description={tr(isArabic, 'لوحة مؤشرات الجودة والالتزام بالإجراءات.', 'Quality indicators and compliance dashboard.')}
      />
      <AdminActionBar>
        <Button type="button" variant="primary">
          {tr(isArabic, 'خطة تحسين', 'Improvement plan')}
        </Button>
        <Button type="button" variant="outline">
          {tr(isArabic, 'تقرير ملخص', 'Summary report')}
        </Button>
      </AdminActionBar>
      <AdminStatsGrid>
        <StatCard label={tr(isArabic, 'مؤشرات نشطة', 'Active indicators')} value={String(rows.length)} icon={HeartPulse} />
        <StatCard label={tr(isArabic, 'مراجعات مفتوحة', 'Open reviews')} value={String(openReviews)} icon={ClipboardList} />
        <StatCard label={tr(isArabic, 'تنبيهات', 'Alerts')} value={String(alerts)} icon={AlertCircle} />
        <StatCard label={tr(isArabic, 'مغلقة هذا الشهر', 'Closed this month')} value={String(closedMonth)} icon={CheckCircle2} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'مؤشرات الجودة', 'Quality indicators')}>
        <DataTable
          emptyTitle={tr(isArabic, 'لا توجد بيانات', 'No data')}
          emptyDescription={tr(isArabic, 'لم يتم العثور على سجلات.', 'No records found.')}
          columns={[
            { key: 'name', label: tr(isArabic, 'المؤشر', 'Indicator') },
            { key: 'owner', label: tr(isArabic, 'المسؤول', 'Owner') },
            { key: 'status', label: tr(isArabic, 'الحالة', 'Status') },
            { key: 'due', label: tr(isArabic, 'الاستحقاق', 'Due') },
            { key: 'actions', label: tr(isArabic, 'الإجراءات', 'Actions') },
          ]}
          rows={rows}
        />
      </SectionCard>
    </div>
  );
}
