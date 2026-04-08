import { ListChecks, ListTree, Scale } from 'lucide-react';
import {
  AdminPageHeader,
  AdminActionBar,
  AdminFilterBar,
  AdminStatsGrid,
  SectionCard,
  SearchInput,
} from '../../components/admin/index.js';
import { Button } from '../../components/common/Button.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { useLocale } from '../../features/locale/index.js';
import { tr } from '../../utils/i18n.js';

export function RubricsPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title={tr(isArabic, 'معايير التقييم', 'Rubrics')}
        description={tr(isArabic, 'بناء وإدارة سلالم التقييم والمعايير الفرعية.', 'Build and manage rubrics and criteria.')}
      />
      <AdminActionBar>
        <Button type="button" variant="primary">
          {tr(isArabic, 'معيار جديد', 'New rubric')}
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput
          placeholder={tr(isArabic, 'بحث بالمعيار', 'Search rubric')}
          aria-label={tr(isArabic, 'بحث', 'Search')}
        />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={tr(isArabic, 'معايير معرّفة', 'Defined rubrics')} value="—" icon={ListChecks} />
        <StatCard label={tr(isArabic, 'مستويات أداء', 'Performance levels')} value="—" icon={ListTree} />
        <StatCard label={tr(isArabic, 'أوزان مرتبطة', 'Linked weights')} value="—" icon={Scale} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'قائمة المعايير', 'Rubrics list')}>
        <DataTable
          emptyTitle={tr(isArabic, 'لا توجد بيانات', 'No data')}
          emptyDescription={tr(isArabic, 'لم يتم العثور على سجلات.', 'No records found.')}
          columns={[
            { key: 'name', label: tr(isArabic, 'المعيار', 'Rubric') },
            { key: 'levels', label: tr(isArabic, 'عدد المستويات', 'Level count') },
            { key: 'linked', label: tr(isArabic, 'مرتبط بتقييمات', 'Linked to assessments') },
            { key: 'updated', label: tr(isArabic, 'آخر تحديث', 'Last update') },
            { key: 'actions', label: tr(isArabic, 'الإجراءات', 'Actions') },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
