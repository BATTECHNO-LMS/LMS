import { useMemo } from 'react';
import { BadgeAlert, Gavel, Lock, Eye } from 'lucide-react';
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
import { ADMIN_INTEGRITY } from '../../mocks/lmsPageData.js';

export function IntegrityCasesPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { filterRows, scopeId } = useTenant();
  const rows = useMemo(() => filterRows(ADMIN_INTEGRITY), [filterRows, scopeId]);

  const openCases = useMemo(() => rows.filter((r) => r.status === 'مفتوحة').length, [rows]);
  const investigating = useMemo(() => rows.filter((r) => r.status === 'قيد التحقيق').length, [rows]);
  const closed = useMemo(() => rows.filter((r) => r.status === 'مغلقة').length, [rows]);
  const archived = useMemo(() => closed, [closed]);

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title={tr(isArabic, 'النزاهة الأكاديمية', 'Academic integrity')}
        description={tr(
          isArabic,
          'إدارة قضايا النزاهة والتحقيقات المرتبطة بالشواهد.',
          'Manage integrity cases and investigations linked to evidence.'
        )}
      />
      <AdminActionBar>
        <Button type="button" variant="primary">
          {tr(isArabic, 'قضية جديدة', 'New case')}
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput
          placeholder={tr(isArabic, 'بحث بالمرجع', 'Search by reference')}
          aria-label={tr(isArabic, 'بحث', 'Search')}
        />
        <SelectField id="int-status" label={tr(isArabic, 'الحالة', 'Status')} defaultValue="">
          <option value="">{tr(isArabic, 'كل الحالات', 'All statuses')}</option>
          <option value="open">{tr(isArabic, 'مفتوحة', 'Open')}</option>
          <option value="closed">{tr(isArabic, 'مغلقة', 'Closed')}</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={tr(isArabic, 'قضايا مفتوحة', 'Open cases')} value={String(openCases)} icon={BadgeAlert} />
        <StatCard label={tr(isArabic, 'قيد التحقيق', 'Under investigation')} value={String(investigating)} icon={Eye} />
        <StatCard label={tr(isArabic, 'قرارات', 'Decisions')} value={String(closed)} icon={Gavel} />
        <StatCard label={tr(isArabic, 'مؤرشفة', 'Archived')} value={String(archived)} icon={Lock} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'قائمة القضايا', 'Cases list')}>
        <DataTable
          emptyTitle={tr(isArabic, 'لا توجد بيانات', 'No data')}
          emptyDescription={tr(isArabic, 'لم يتم العثور على سجلات.', 'No records found.')}
          columns={[
            { key: 'ref', label: tr(isArabic, 'المرجع', 'Reference') },
            { key: 'type', label: tr(isArabic, 'النوع', 'Type') },
            { key: 'party', label: tr(isArabic, 'الجهة', 'Party') },
            { key: 'status', label: tr(isArabic, 'الحالة', 'Status') },
            { key: 'updated', label: tr(isArabic, 'آخر تحديث', 'Last update') },
            { key: 'actions', label: tr(isArabic, 'الإجراءات', 'Actions') },
          ]}
          rows={rows}
        />
      </SectionCard>
    </div>
  );
}
