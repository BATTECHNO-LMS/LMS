import { ClipboardCheck, UserCheck, UserX, Percent } from 'lucide-react';
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

export function AttendancePage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title={tr(isArabic, 'الحضور', 'Attendance')}
        description={tr(isArabic, 'متابعة الحضور والغياب على مستوى الجلسات والدفعات.', 'Track attendance and absence across sessions and cohorts.')}
      />
      <AdminActionBar>
        <Button type="button" variant="primary">
          {tr(isArabic, 'تصدير تقرير', 'Export report')}
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput placeholder={tr(isArabic, 'بحث بالمتعلّم', 'Search learner')} aria-label={tr(isArabic, 'بحث', 'Search')} />
        <SelectField id="att-cohort" label={tr(isArabic, 'الدفعة', 'Cohort')} defaultValue="">
          <option value="">{tr(isArabic, 'كل الدفعات', 'All cohorts')}</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={tr(isArabic, 'متوسط الحضور', 'Attendance average')} value="—" icon={Percent} />
        <StatCard label={tr(isArabic, 'حضور مؤكد', 'Confirmed attendance')} value="—" icon={UserCheck} />
        <StatCard label={tr(isArabic, 'غياب مسجّل', 'Recorded absences')} value="—" icon={UserX} />
        <StatCard label={tr(isArabic, 'جلسات مغطاة', 'Covered sessions')} value="—" icon={ClipboardCheck} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'سجل الحضور', 'Attendance log')}>
        <DataTable
          emptyTitle={tr(isArabic, 'لا توجد بيانات', 'No data')}
          emptyDescription={tr(isArabic, 'لم يتم العثور على سجلات.', 'No records found.')}
          columns={[
            { key: 'learner', label: tr(isArabic, 'المتعلّم', 'Learner') },
            { key: 'session', label: tr(isArabic, 'الجلسة', 'Session') },
            { key: 'status', label: tr(isArabic, 'الحالة', 'Status') },
            { key: 'time', label: tr(isArabic, 'الوقت', 'Time') },
            { key: 'actions', label: tr(isArabic, 'الإجراءات', 'Actions') },
          ]}
          rows={[]}
        />
      </SectionCard>
    </div>
  );
}
