import { BarChart3, Award, Users, ClipboardCheck } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { UI_PERMISSION } from '../../constants/permissions.js';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { PermissionGate } from '../../components/permissions/PermissionGate.jsx';
import { PagePermissionGate } from '../../components/permissions/PagePermissionGate.jsx';
import { Button } from '../../components/common/Button.jsx';
import { useLocale } from '../../features/locale/index.js';
import { useTenant } from '../../features/tenant/index.js';

const GRADING_ROWS = [
  {
    id: '1',
    student: 'محمد علي',
    studentAr: 'محمد علي',
    studentEn: 'Mohammad Ali',
    assessment: 'واجب التحليل',
    assessmentAr: 'واجب التحليل',
    assessmentEn: 'Analysis assignment',
    score: '88',
    status: 'منشور',
    statusAr: 'منشور',
    statusEn: 'Published',
    tenantId: 'uni-1',
  },
  {
    id: '2',
    student: 'سارة أحمد',
    studentAr: 'سارة أحمد',
    studentEn: 'Sarah Ahmad',
    assessment: 'واجب التحليل',
    assessmentAr: 'واجب التحليل',
    assessmentEn: 'Analysis assignment',
    score: '92',
    status: 'منشور',
    statusAr: 'منشور',
    statusEn: 'Published',
    tenantId: 'uni-1',
  },
  {
    id: '3',
    student: 'خالد سعيد',
    studentAr: 'خالد سعيد',
    studentEn: 'Khaled Saeed',
    assessment: 'معمل Python',
    assessmentAr: 'معمل Python',
    assessmentEn: 'Python lab',
    score: '—',
    status: 'مسودة',
    statusAr: 'مسودة',
    statusEn: 'Draft',
    tenantId: 'uni-1',
  },
  {
    id: '4',
    student: 'دانيا مرعي',
    studentAr: 'دانيا مرعي',
    studentEn: 'Dania Marai',
    assessment: 'معمل البيانات',
    assessmentAr: 'معمل البيانات',
    assessmentEn: 'Data lab',
    score: '79',
    status: 'منشور',
    statusAr: 'منشور',
    statusEn: 'Published',
    tenantId: 'uni-1',
  },
  {
    id: '5',
    student: 'محمد علي',
    studentAr: 'محمد علي',
    studentEn: 'Mohammad Ali',
    assessment: 'معمل البيانات',
    assessmentAr: 'معمل البيانات',
    assessmentEn: 'Data lab',
    score: '—',
    status: 'بانتظار التصحيح',
    statusAr: 'بانتظار التصحيح',
    statusEn: 'Pending',
    tenantId: 'uni-1',
  },
];

export function InstructorGradesPage() {
  const { t } = useTranslation('grades');
  const { t: tCommon } = useTranslation('common');
  const P = UI_PERMISSION;
  const { locale } = useLocale();
  const { filterRows, scopeId } = useTenant();
  const isArabic = locale === 'ar';
  const scoped = useMemo(() => filterRows(GRADING_ROWS), [filterRows, scopeId]);
  const rows = scoped.map((r) => ({
    ...r,
    student: isArabic ? r.studentAr ?? r.student : r.studentEn ?? r.student,
    assessment: isArabic ? r.assessmentAr ?? r.assessment : r.assessmentEn ?? r.assessment,
    status: isArabic ? r.statusAr ?? r.status : r.statusEn ?? r.status,
  }));

  return (
    <PagePermissionGate permission={P.canViewGradesTeaching}>
      <div className="page page--dashboard page--instructor">
        <AdminPageHeader title={<>{t('instructor.title')}</>} description={<>{t('instructor.description')}</>} />
        <AdminFilterBar>
          <SearchInput placeholder={t('instructor.searchPlaceholder')} aria-label={t('instructor.searchAria')} />
        </AdminFilterBar>
        <AdminStatsGrid>
          <StatCard label={t('instructor.stats.awaitingPublish')} value="—" icon={ClipboardCheck} />
          <StatCard label={t('instructor.stats.cohortAverage')} value="—" icon={BarChart3} />
          <StatCard label={t('instructor.stats.students')} value="—" icon={Users} />
          <StatCard label={t('instructor.stats.topScore')} value="—" icon={Award} />
        </AdminStatsGrid>
        <SectionCard title={<>{t('instructor.sectionTitle')}</>}>
          <DataTable
            emptyTitle={t('instructor.empty.title')}
            emptyDescription={t('instructor.empty.description')}
            columns={[
              { key: 'student', label: t('instructor.table.student') },
              { key: 'assessment', label: t('instructor.table.assessment') },
              { key: 'score', label: t('instructor.table.score') },
              { key: 'status', label: t('instructor.table.status') },
              {
                key: 'actions',
                label: tCommon('table.actions'),
                render: () => (
                  <div className="table-row-actions">
                    <PermissionGate permission={P.canGradeAssessments}>
                      <Button type="button" variant="outline">
                        {tCommon('actions.edit')}
                      </Button>
                    </PermissionGate>
                    <PermissionGate permission={P.canPublishFeedback}>
                      <Button type="button" variant="primary">
                        {t('instructor.actions.publish')}
                      </Button>
                    </PermissionGate>
                  </div>
                ),
              },
            ]}
            rows={rows}
          />
        </SectionCard>
      </div>
    </PagePermissionGate>
  );
}
