import { Upload, Inbox, Clock, CheckCircle2 } from 'lucide-react';
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

export function SubmissionsPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title={tr(isArabic, 'التسليمات', 'Submissions')}
        description={tr(
          isArabic,
          'متابعة تسليمات المتعلّمين وحالات التصحيح.',
          'Track learner submissions and grading status.'
        )}
      />
      <AdminActionBar>
        <Button type="button" variant="primary">
          {tr(isArabic, 'تصدير', 'Export')}
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput
          placeholder={tr(isArabic, 'بحث بالمتعلّم', 'Search learner')}
          aria-label={tr(isArabic, 'بحث', 'Search')}
        />
        <SelectField id="sub-status" label={tr(isArabic, 'الحالة', 'Status')} defaultValue="">
          <option value="">{tr(isArabic, 'كل الحالات', 'All statuses')}</option>
          <option value="pending">{tr(isArabic, 'بانتظار التصحيح', 'Pending grading')}</option>
          <option value="graded">{tr(isArabic, 'مُصحَّح', 'Graded')}</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={tr(isArabic, 'تسليمات جديدة', 'New submissions')} value="—" icon={Inbox} />
        <StatCard label={tr(isArabic, 'بانتظار التصحيح', 'Pending grading')} value="—" icon={Clock} />
        <StatCard label={tr(isArabic, 'مكتملة', 'Completed')} value="—" icon={CheckCircle2} />
        <StatCard label={tr(isArabic, 'مرفوعات', 'Uploads')} value="—" icon={Upload} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'قائمة التسليمات', 'Submissions list')}>
        <DataTable
          emptyTitle={tr(isArabic, 'لا توجد بيانات', 'No data')}
          emptyDescription={tr(isArabic, 'لم يتم العثور على سجلات.', 'No records found.')}
          columns={[
            { key: 'learner', label: tr(isArabic, 'المتعلّم', 'Learner') },
            { key: 'task', label: tr(isArabic, 'المهمة', 'Task') },
            { key: 'submitted', label: tr(isArabic, 'تاريخ التسليم', 'Submission date') },
            { key: 'status', label: tr(isArabic, 'الحالة', 'Status') },
            { key: 'actions', label: tr(isArabic, 'الإجراءات', 'Actions') },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
