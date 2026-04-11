import { useMemo } from 'react';
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
import { useTenant } from '../../features/tenant/index.js';
import { tr } from '../../utils/i18n.js';
import { ADMIN_ATTENDANCE_LOG } from '../../mocks/lmsPageData.js';

export function AttendancePage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { filterRows, scopeId } = useTenant();
  const rows = useMemo(() => filterRows(ADMIN_ATTENDANCE_LOG), [filterRows, scopeId]);
  const present = useMemo(() => rows.filter((r) => r.status === 'حاضر').length, [rows]);
  const absent = useMemo(() => rows.filter((r) => r.status === 'غائب').length, [rows]);

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
        <StatCard
          label={tr(isArabic, 'متوسط الحضور', 'Attendance average')}
          value={rows.length ? `${Math.round((present / rows.length) * 100)}%` : '—'}
          icon={Percent}
        />
        <StatCard label={tr(isArabic, 'حضور مؤكد', 'Confirmed attendance')} value={String(present)} icon={UserCheck} />
        <StatCard label={tr(isArabic, 'غياب مسجّل', 'Recorded absences')} value={String(absent)} icon={UserX} />
        <StatCard label={tr(isArabic, 'جلسات مغطاة', 'Covered sessions')} value={String(new Set(rows.map((r) => r.session)).size)} icon={ClipboardCheck} />
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
          rows={rows}
        />
      </SectionCard>
    </div>
  );
}
