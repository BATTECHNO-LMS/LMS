import { useMemo } from 'react';
import { ClipboardList, AlertTriangle, Timer, CheckCircle2 } from 'lucide-react';
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
import { ADMIN_CORRECTIVE } from '../../mocks/lmsPageData.js';

export function CorrectiveActionsPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { filterRows, scopeId } = useTenant();
  const rows = useMemo(() => filterRows(ADMIN_CORRECTIVE), [filterRows, scopeId]);

  const openCount = useMemo(() => rows.filter((r) => r.status === 'مفتوح').length, [rows]);
  const doneCount = useMemo(() => rows.filter((r) => r.status === 'مكتمل').length, [rows]);
  const overdueHint = useMemo(() => {
    const today = new Date('2026-04-08');
    return rows.filter((r) => {
      if (r.status === 'مكتمل') return false;
      const d = new Date(r.due);
      return d < today;
    }).length;
  }, [rows]);

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title={tr(isArabic, 'الإجراءات التصحيحية', 'Corrective actions')}
        description={tr(
          isArabic,
          'متابعة خطط المعالجة والإغلاق بعد مراجعات الجودة.',
          'Track remediation plans and closure after quality reviews.'
        )}
      />
      <AdminActionBar>
        <Button type="button" variant="primary">
          {tr(isArabic, 'إجراء جديد', 'New action')}
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput
          placeholder={tr(isArabic, 'بحث بالوحدة', 'Search by unit')}
          aria-label={tr(isArabic, 'بحث', 'Search')}
        />
        <SelectField id="ca-status" label={tr(isArabic, 'الحالة', 'Status')} defaultValue="">
          <option value="">{tr(isArabic, 'كل الحالات', 'All statuses')}</option>
          <option value="open">{tr(isArabic, 'مفتوح', 'Open')}</option>
          <option value="done">{tr(isArabic, 'مكتمل', 'Done')}</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={tr(isArabic, 'إجراءات مفتوحة', 'Open actions')} value={String(openCount)} icon={AlertTriangle} />
        <StatCard label={tr(isArabic, 'متأخرة', 'Overdue')} value={String(overdueHint)} icon={Timer} />
        <StatCard label={tr(isArabic, 'مغلقة', 'Closed')} value={String(doneCount)} icon={CheckCircle2} />
        <StatCard label={tr(isArabic, 'خطط نشطة', 'Active plans')} value={String(rows.length)} icon={ClipboardList} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'قائمة الإجراءات التصحيحية', 'Corrective actions list')}>
        <DataTable
          emptyTitle={tr(isArabic, 'لا توجد بيانات', 'No data')}
          emptyDescription={tr(isArabic, 'لم يتم العثور على سجلات.', 'No records found.')}
          columns={[
            { key: 'id', label: tr(isArabic, 'المرجع', 'Reference') },
            { key: 'issue', label: tr(isArabic, 'الملاحظة', 'Finding') },
            { key: 'owner', label: tr(isArabic, 'المسؤول', 'Owner') },
            { key: 'due', label: tr(isArabic, 'الاستحقاق', 'Due') },
            { key: 'status', label: tr(isArabic, 'الحالة', 'Status') },
            { key: 'actions', label: tr(isArabic, 'الإجراءات', 'Actions') },
          ]}
          rows={rows}
        />
      </SectionCard>
    </div>
  );
}
