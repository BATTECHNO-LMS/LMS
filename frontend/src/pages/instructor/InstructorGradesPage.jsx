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
import { useGrades } from '../../features/grades/index.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

export function InstructorGradesPage() {
  const { t } = useTranslation('grades');
  const { t: tCommon } = useTranslation('common');
  const P = UI_PERMISSION;
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { data: gradesPayload, isLoading, isError, error } = useGrades({}, { staleTime: 30_000 });
  const rows = useMemo(
    () =>
      (gradesPayload?.grades ?? []).map((g) => ({
        id: g.id,
        student: g.student?.full_name ?? '—',
        assessment: g.assessment?.title ?? '—',
        score: g.score != null ? String(g.score) : '—',
        status: g.is_final ? (isArabic ? 'منشور' : 'Published') : isArabic ? 'مسودة' : 'Draft',
      })),
    [gradesPayload, isArabic]
  );
  const loadError = isError ? getApiErrorMessage(error, tCommon('errors.generic')) : '';
  const awaitingPublish = rows.filter((r) => r.status === 'Draft' || r.status === 'مسودة').length;
  const numericScores = rows.map((r) => Number(r.score)).filter((n) => !Number.isNaN(n));
  const avgScore = numericScores.length
    ? String((numericScores.reduce((a, b) => a + b, 0) / numericScores.length).toFixed(1))
    : '—';
  const topScore = numericScores.length ? String(Math.max(...numericScores)) : '—';

  return (
    <PagePermissionGate permission={P.canViewGradesTeaching}>
      <div className="page page--dashboard page--instructor">
        <AdminPageHeader title={<>{t('instructor.title')}</>} description={<>{t('instructor.description')}</>} />
        <AdminFilterBar>
          <SearchInput placeholder={t('instructor.searchPlaceholder')} aria-label={t('instructor.searchAria')} />
        </AdminFilterBar>
        <AdminStatsGrid>
          <StatCard label={t('instructor.stats.awaitingPublish')} value={String(awaitingPublish)} icon={ClipboardCheck} />
          <StatCard label={t('instructor.stats.cohortAverage')} value={avgScore} icon={BarChart3} />
          <StatCard label={t('instructor.stats.students')} value={String(rows.length)} icon={Users} />
          <StatCard label={t('instructor.stats.topScore')} value={topScore} icon={Award} />
        </AdminStatsGrid>
        <SectionCard title={<>{t('instructor.sectionTitle')}</>}>
          {isLoading ? <LoadingSpinner /> : null}
          {loadError ? <p className="crud-muted">{loadError}</p> : null}
          {!isLoading ? (
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
              rows={loadError ? [] : rows}
            />
          ) : null}
        </SectionCard>
      </div>
    </PagePermissionGate>
  );
}
