import { useMemo } from 'react';
import { BookOpen, FileText, Link2, Layers } from 'lucide-react';
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
import { ADMIN_CONTENT } from '../../mocks/lmsPageData.js';

export function ContentManagementPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { filterRows, scopeId } = useTenant();
  const rows = useMemo(() => filterRows(ADMIN_CONTENT), [filterRows, scopeId]);
  const published = useMemo(() => rows.filter((r) => r.status === 'منشور').length, [rows]);

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title={tr(isArabic, 'المحتوى', 'Content')}
        description={tr(
          isArabic,
          'إدارة الوحدات التعليمية والموارد المرتبطة بالدفعات.',
          'Manage learning units and resources linked to cohorts.'
        )}
      />
      <AdminActionBar>
        <Button type="button" variant="primary">
          {tr(isArabic, 'وحدة جديدة', 'New unit')}
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput
          placeholder={tr(isArabic, 'بحث بالعنوان', 'Search by title')}
          aria-label={tr(isArabic, 'بحث', 'Search')}
        />
        <SelectField id="content-type" label={tr(isArabic, 'النوع', 'Type')} defaultValue="">
          <option value="">{tr(isArabic, 'كل الأنواع', 'All types')}</option>
          <option value="video">{tr(isArabic, 'مرئي', 'Video')}</option>
          <option value="doc">{tr(isArabic, 'وثيقة', 'Document')}</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={tr(isArabic, 'وحدات منشورة', 'Published units')} value={String(published)} icon={BookOpen} />
        <StatCard label={tr(isArabic, 'مسودات', 'Drafts')} value={String(rows.length - published)} icon={FileText} />
        <StatCard label={tr(isArabic, 'روابط خارجية', 'External links')} value={String(rows.filter((r) => r.type === 'رابط').length)} icon={Link2} />
        <StatCard label={tr(isArabic, 'مرتبطة بدفعات', 'Linked to cohorts')} value={String(rows.length)} icon={Layers} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'قائمة المحتوى', 'Content list')}>
        <DataTable
          emptyTitle={tr(isArabic, 'لا توجد بيانات', 'No data')}
          emptyDescription={tr(isArabic, 'لم يتم العثور على سجلات.', 'No records found.')}
          columns={[
            { key: 'title', label: tr(isArabic, 'العنوان', 'Title') },
            { key: 'type', label: tr(isArabic, 'النوع', 'Type') },
            { key: 'cohort', label: tr(isArabic, 'الدفعة', 'Cohort') },
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
