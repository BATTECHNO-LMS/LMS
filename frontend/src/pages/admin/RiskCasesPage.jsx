import { useMemo } from 'react';
import { AlertTriangle, TrendingUp, UserX, ShieldAlert } from 'lucide-react';
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
import { ADMIN_RISK_CASES } from '../../mocks/lmsPageData.js';

export function RiskCasesPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { filterRows, scopeId } = useTenant();
  const rows = useMemo(() => filterRows(ADMIN_RISK_CASES), [filterRows, scopeId]);

  const openCases = useMemo(() => rows.filter((r) => r.status === 'مفتوحة').length, [rows]);
  const inProgress = useMemo(() => rows.filter((r) => r.status === 'قيد المتابعة').length, [rows]);
  const closed = useMemo(() => rows.filter((r) => r.status === 'مغلقة').length, [rows]);
  const escalating = useMemo(() => rows.filter((r) => r.level === 'مرتفع' && r.status !== 'مغلقة').length, [rows]);

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title={tr(isArabic, 'حالات المخاطر', 'Risk cases')}
        description={tr(isArabic, 'تتبّع مخاطر الأداء الأكاديمي والتدخلات.', 'Track academic performance risks and interventions.')}
      />
      <AdminActionBar>
        <Button type="button" variant="primary">
          {tr(isArabic, 'تسجيل حالة', 'Log case')}
        </Button>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput
          placeholder={tr(isArabic, 'بحث بالمتعلّم', 'Search learner')}
          aria-label={tr(isArabic, 'بحث', 'Search')}
        />
        <SelectField id="risk-level" label={tr(isArabic, 'المستوى', 'Level')} defaultValue="">
          <option value="">{tr(isArabic, 'كل المستويات', 'All levels')}</option>
          <option value="high">{tr(isArabic, 'مرتفع', 'High')}</option>
          <option value="medium">{tr(isArabic, 'متوسط', 'Medium')}</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={tr(isArabic, 'حالات مفتوحة', 'Open cases')} value={String(openCases)} icon={AlertTriangle} />
        <StatCard label={tr(isArabic, 'متصاعدة', 'Escalating')} value={String(escalating)} icon={TrendingUp} />
        <StatCard label={tr(isArabic, 'مغلقة', 'Closed')} value={String(closed)} icon={ShieldAlert} />
        <StatCard label={tr(isArabic, 'متابعة نشطة', 'Active follow-up')} value={String(inProgress)} icon={UserX} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'قائمة الحالات', 'Cases list')}>
        <DataTable
          emptyTitle={tr(isArabic, 'لا توجد بيانات', 'No data')}
          emptyDescription={tr(isArabic, 'لم يتم العثور على سجلات.', 'No records found.')}
          columns={[
            { key: 'learner', label: tr(isArabic, 'المتعلّم', 'Learner') },
            { key: 'cohort', label: tr(isArabic, 'الدفعة', 'Cohort') },
            { key: 'level', label: tr(isArabic, 'المستوى', 'Level') },
            { key: 'owner', label: tr(isArabic, 'المسؤول', 'Owner') },
            { key: 'status', label: tr(isArabic, 'الحالة', 'Status') },
            { key: 'actions', label: tr(isArabic, 'الإجراءات', 'Actions') },
          ]}
          rows={rows}
        />
      </SectionCard>
    </div>
  );
}
