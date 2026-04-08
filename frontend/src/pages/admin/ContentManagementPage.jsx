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
import { tr } from '../../utils/i18n.js';

export function ContentManagementPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';

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
        <StatCard label={tr(isArabic, 'وحدات منشورة', 'Published units')} value="—" icon={BookOpen} />
        <StatCard label={tr(isArabic, 'مسودات', 'Drafts')} value="—" icon={FileText} />
        <StatCard label={tr(isArabic, 'روابط خارجية', 'External links')} value="—" icon={Link2} />
        <StatCard label={tr(isArabic, 'مرتبطة بدفعات', 'Linked to cohorts')} value="—" icon={Layers} />
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
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
