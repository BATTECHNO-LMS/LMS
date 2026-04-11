import { useMemo } from 'react';
import { ShieldCheck, User, Calendar, Flag } from 'lucide-react';
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
import { ADMIN_QA_REVIEWS } from '../../mocks/lmsPageData.js';

export function QAReviewsPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { filterRows, scopeId } = useTenant();
  const rows = useMemo(() => filterRows(ADMIN_QA_REVIEWS), [filterRows, scopeId]);

  const scheduled = useMemo(() => rows.filter((r) => r.status === 'مجدولة' || r.status === 'قيد التحضير').length, [rows]);
  const reviewers = useMemo(() => new Set(rows.map((r) => r.lead)).size, [rows]);
  const critical = useMemo(() => rows.filter((r) => r.status === 'مفتوحة').length, [rows]);
  const completed = useMemo(() => rows.filter((r) => r.status === 'مغلقة').length, [rows]);

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title={tr(isArabic, 'مراجعات الجودة', 'QA reviews')}
        description={tr(isArabic, 'جدولة ومتابعة جولات المراجعة الداخلية.', 'Schedule and track internal review rounds.')}
      />
      <AdminActionBar>
        <Button type="button" variant="primary">
          {tr(isArabic, 'مراجعة جديدة', 'New review')}
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput
          placeholder={tr(isArabic, 'بحث بالدفعة أو الوحدة', 'Search by cohort or unit')}
          aria-label={tr(isArabic, 'بحث', 'Search')}
        />
        <SelectField id="qa-status" label={tr(isArabic, 'الحالة', 'Status')} defaultValue="">
          <option value="">{tr(isArabic, 'كل الحالات', 'All statuses')}</option>
          <option value="open">{tr(isArabic, 'مفتوحة', 'Open')}</option>
          <option value="closed">{tr(isArabic, 'مغلقة', 'Closed')}</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={tr(isArabic, 'مراجعات مجدولة', 'Scheduled reviews')} value={String(scheduled)} icon={Calendar} />
        <StatCard label={tr(isArabic, 'مراجعون', 'Reviewers')} value={String(reviewers)} icon={User} />
        <StatCard label={tr(isArabic, 'ملاحظات حرجة', 'Critical notes')} value={String(critical)} icon={Flag} />
        <StatCard label={tr(isArabic, 'مكتملة', 'Completed')} value={String(completed)} icon={ShieldCheck} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'قائمة المراجعات', 'Reviews list')}>
        <DataTable
          emptyTitle={tr(isArabic, 'لا توجد بيانات', 'No data')}
          emptyDescription={tr(isArabic, 'لم يتم العثور على سجلات.', 'No records found.')}
          columns={[
            { key: 'title', label: tr(isArabic, 'المراجعة', 'Review') },
            { key: 'scope', label: tr(isArabic, 'النطاق', 'Scope') },
            { key: 'lead', label: tr(isArabic, 'قائد المراجعة', 'Review lead') },
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
