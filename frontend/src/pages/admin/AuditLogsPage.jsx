import { useMemo } from 'react';
import { ScrollText, User, Monitor, Filter } from 'lucide-react';
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
import { ADMIN_AUDIT_LOGS } from '../../mocks/lmsPageData.js';

export function AuditLogsPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { filterRows, scopeId } = useTenant();
  const rows = useMemo(() => filterRows(ADMIN_AUDIT_LOGS), [filterRows, scopeId]);
  const actors = useMemo(() => new Set(rows.map((r) => r.actor)).size, [rows]);

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title={tr(isArabic, 'سجل التدقيق', 'Audit log')}
        description={tr(isArabic, 'سجل العمليات الحساسة والوصول للبيانات.', 'Log of sensitive operations and data access.')}
      />
      <AdminActionBar>
        <Button type="button" variant="primary">
          {tr(isArabic, 'تصدير السجل', 'Export log')}
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput
          placeholder={tr(isArabic, 'بحث بالحدث أو المستخدم', 'Search by event or user')}
          aria-label={tr(isArabic, 'بحث', 'Search')}
        />
        <SelectField id="audit-level" label={tr(isArabic, 'الخطورة', 'Severity')} defaultValue="">
          <option value="">{tr(isArabic, 'كل المستويات', 'All levels')}</option>
          <option value="high">{tr(isArabic, 'مرتفع', 'High')}</option>
          <option value="low">{tr(isArabic, 'منخفض', 'Low')}</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={tr(isArabic, 'أحداث اليوم', 'Today events')} value={String(rows.length)} icon={ScrollText} />
        <StatCard label={tr(isArabic, 'مستخدمون فريدون', 'Unique users')} value={String(actors)} icon={User} />
        <StatCard label={tr(isArabic, 'مصادر', 'Sources')} value={String(rows.filter((r) => r.ip !== '—').length)} icon={Monitor} />
        <StatCard label={tr(isArabic, 'مرشّحات نشطة', 'Active filters')} value="3" icon={Filter} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'السجل', 'Log')}>
        <DataTable
          emptyTitle={tr(isArabic, 'لا توجد بيانات', 'No data')}
          emptyDescription={tr(isArabic, 'لم يتم العثور على سجلات.', 'No records found.')}
          columns={[
            { key: 'time', label: tr(isArabic, 'الوقت', 'Time') },
            { key: 'actor', label: tr(isArabic, 'المستخدم', 'User') },
            { key: 'action', label: tr(isArabic, 'الحدث', 'Event') },
            { key: 'resource', label: tr(isArabic, 'المورد', 'Resource') },
            { key: 'ip', label: tr(isArabic, 'المصدر', 'Source') },
          ]}
          rows={rows}
        />
      </SectionCard>
    </div>
  );
}
