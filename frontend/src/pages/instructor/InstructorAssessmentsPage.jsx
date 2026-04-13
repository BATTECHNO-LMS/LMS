import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileCheck, ClipboardList, Timer, BarChart3, Plus, Eye, Pencil } from 'lucide-react';
import { UI_PERMISSION } from '../../constants/permissions.js';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminActionBar } from '../../components/admin/AdminActionBar.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import { PermissionGate } from '../../components/permissions/PermissionGate.jsx';
import { PagePermissionGate } from '../../components/permissions/PagePermissionGate.jsx';
import { AssessmentTypeBadge } from '../../components/assessment/AssessmentTypeBadge.jsx';
import { genericStatusVariant, statusLabelAr } from '../../utils/statusMap.js';
import { useAssessments } from '../../features/assessments/index.js';
import { useLocale } from '../../features/locale/index.js';

export function InstructorAssessmentsPage() {
  const { t } = useTranslation('assessments');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const P = UI_PERMISSION;
  const [q, setQ] = useState('');

  const listParams = useMemo(() => {
    const p = {};
    const s = q.trim();
    if (s) p.search = s;
    return p;
  }, [q]);

  const { data, isLoading, isError, error } = useAssessments(listParams, { staleTime: 30_000 });
  const assessments = data?.assessments ?? [];

  const stats = useMemo(() => {
    const active = assessments.filter((a) => a.status === 'open' || a.status === 'published').length;
    return { total: assessments.length, active };
  }, [assessments]);

  return (
    <PagePermissionGate permission={P.canViewAssessments}>
      <div className="page page--dashboard page--instructor">
        <AdminPageHeader title={<>{t('instructor.title')}</>} description={<>{t('instructor.description')}</>} />
        <AdminActionBar>
          <PermissionGate permission={P.canCreateAssessments}>
            <Link className="btn btn--primary" to="/instructor/assessments/create">
              <Plus size={18} aria-hidden /> {t('instructor.addAssessment')}
            </Link>
          </PermissionGate>
        </AdminActionBar>
        <AdminFilterBar>
          <SearchInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('instructor.searchPlaceholder')}
            aria-label={t('instructor.searchAria')}
          />
        </AdminFilterBar>
        <AdminStatsGrid>
          <StatCard label={t('instructor.stats.active')} value={String(stats.active)} icon={FileCheck} />
          <StatCard label={t('instructor.stats.totalListed')} value={String(stats.total)} icon={ClipboardList} />
          <StatCard label={t('instructor.stats.upcoming')} value="—" icon={Timer} />
          <StatCard label={t('instructor.stats.averageGrades')} value="—" icon={BarChart3} />
        </AdminStatsGrid>
        <SectionCard title={<>{t('instructor.listTitle')}</>}>
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <DataTable
              emptyTitle={isError ? tCommon('errors.generic') : t('instructor.empty.title')}
              emptyDescription={isError ? String(error?.message ?? '') : t('instructor.empty.description')}
              columns={[
                { key: 'title', label: t('instructor.table.name') },
                {
                  key: 'type',
                  label: t('instructor.table.type'),
                  render: (r) => <AssessmentTypeBadge type={r.assessment_type} />,
                },
                { key: 'weight', label: t('instructor.table.weight'), render: (r) => `${r.weight ?? '—'}%` },
                {
                  key: 'learningOutcome',
                  label: t('instructor.table.learningOutcome'),
                  render: (r) => r.linked_outcome?.outcome_code ?? '—',
                },
                {
                  key: 'openDate',
                  label: t('instructor.table.openDate'),
                  render: (r) => (r.open_at ? String(r.open_at).slice(0, 10) : '—'),
                },
                {
                  key: 'closeDate',
                  label: t('instructor.table.closeDate'),
                  render: (r) => (r.due_date ? String(r.due_date).slice(0, 10) : '—'),
                },
                {
                  key: 'submissionsCount',
                  label: t('instructor.table.submissionsCount'),
                  render: () => '—',
                },
                {
                  key: 'status',
                  label: t('instructor.table.status'),
                  render: (r) => (
                    <StatusBadge variant={genericStatusVariant(r.status)}>{statusLabelAr(r.status, locale)}</StatusBadge>
                  ),
                },
                {
                  key: 'actions',
                  label: tCommon('table.actions'),
                  render: (r) => (
                    <div className="table-row-actions">
                      <Link className="btn btn--icon btn--ghost" to={`/instructor/assessments/${r.id}`} title={tCommon('actions.view')} aria-label={tCommon('actions.view')}>
                        <Eye size={18} />
                      </Link>
                      <PermissionGate permission={P.canEditAssessments}>
                        <Link
                          className="btn btn--icon btn--ghost"
                          to={`/instructor/assessments/${r.id}/edit`}
                          title={t('instructor.actions.edit')}
                          aria-label={t('instructor.actions.edit')}
                        >
                          <Pencil size={18} />
                        </Link>
                      </PermissionGate>
                    </div>
                  ),
                },
              ]}
              rows={assessments}
              footer={
                <PermissionGate permission={P.canCreateAssessments}>
                  <div className="data-table__footer-actions">
                    <Link className="btn btn--primary" to="/instructor/assessments/create">
                      <Plus size={18} aria-hidden /> {t('instructor.addAssessment')}
                    </Link>
                  </div>
                </PermissionGate>
              }
            />
          )}
        </SectionCard>
      </div>
    </PagePermissionGate>
  );
}
