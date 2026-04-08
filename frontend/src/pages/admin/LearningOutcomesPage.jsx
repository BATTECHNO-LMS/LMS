import { ListTree, Target, BookMarked, Layers } from 'lucide-react';
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

export function LearningOutcomesPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title={tr(isArabic, 'مخرجات التعلم', 'Learning outcomes')}
        description={tr(
          isArabic,
          'ربط مخرجات التعلم بالشهادات والمقاييس الأكاديمية.',
          'Link learning outcomes to certificates and academic standards.'
        )}
      />
      <AdminActionBar>
        <Button type="button" variant="primary">
          {tr(isArabic, 'مخرج جديد', 'New outcome')}
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput
          placeholder={tr(isArabic, 'بحث بالرمز أو الوصف', 'Search by code or description')}
          aria-label={tr(isArabic, 'بحث', 'Search')}
        />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={tr(isArabic, 'مخرجات معرّفة', 'Defined outcomes')} value="—" icon={ListTree} />
        <StatCard label={tr(isArabic, 'مرتبطة بشهادات', 'Linked to certificates')} value="—" icon={BookMarked} />
        <StatCard label={tr(isArabic, 'مقاييس نشطة', 'Active standards')} value="—" icon={Target} />
        <StatCard label={tr(isArabic, 'دفعات مغطاة', 'Covered cohorts')} value="—" icon={Layers} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'قائمة مخرجات التعلم', 'Learning outcomes list')}>
        <DataTable
          emptyTitle={tr(isArabic, 'لا توجد بيانات', 'No data')}
          emptyDescription={tr(isArabic, 'لم يتم العثور على سجلات.', 'No records found.')}
          columns={[
            { key: 'code', label: tr(isArabic, 'الرمز', 'Code') },
            { key: 'title', label: tr(isArabic, 'الوصف', 'Description') },
            { key: 'credential', label: tr(isArabic, 'الشهادة', 'Certificate') },
            { key: 'status', label: tr(isArabic, 'الحالة', 'Status') },
            { key: 'actions', label: tr(isArabic, 'الإجراءات', 'Actions') },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
