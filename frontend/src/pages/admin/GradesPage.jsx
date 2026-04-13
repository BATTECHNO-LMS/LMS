import { useMemo, useState } from 'react';
import { BarChart3, Sigma, TrendingUp, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  AdminPageHeader,
  AdminActionBar,
  AdminFilterBar,
  AdminStatsGrid,
  SectionCard,
  SearchInput,
  SelectField,
} from '../../components/admin/index.js';
import { StatCard } from '../../components/common/StatCard.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { useGrades } from '../../features/grades/index.js';
import { useCohorts } from '../../features/cohorts/index.js';
import { statusLabelAr } from '../../utils/statusMap.js';
import { useLocale } from '../../features/locale/index.js';

export function GradesPage() {
  const { t } = useTranslation('grades');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const [q, setQ] = useState('');
  const [cohortId, setCohortId] = useState('');

  const { data: cohortsPayload } = useCohorts({}, { staleTime: 60_000 });
  const cohorts = cohortsPayload?.cohorts ?? [];

  const params = useMemo(() => {
    const p = {};
    if (cohortId) p.cohort_id = cohortId;
    return p;
  }, [cohortId]);

  const { data, isLoading, isError, error } = useGrades(params, { staleTime: 30_000 });
  const rowsAll = data?.grades ?? [];
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rowsAll;
    return rowsAll.filter(
      (r) =>
        (r.student?.full_name && r.student.full_name.toLowerCase().includes(s)) ||
        (r.assessment?.title && r.assessment.title.toLowerCase().includes(s))
    );
  }, [rowsAll, q]);

  const avg = useMemo(() => {
    const nums = rows.map((r) => Number(r.score)).filter((n) => !Number.isNaN(n));
    if (!nums.length) return '—';
    return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1);
  }, [rows]);
  const pass = useMemo(() => rows.filter((r) => Number(r.score) >= 60).length, [rows]);
  const top = useMemo(() => {
    const nums = rows.map((r) => Number(r.score)).filter((n) => !Number.isNaN(n));
    if (!nums.length) return '—';
    return String(Math.max(...nums));
  }, [rows]);

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader title={<>{t('instructor.title')}</>} description={<>{t('instructor.description')}</>} />
      <AdminActionBar />
      <AdminFilterBar>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('instructor.searchPlaceholder')}
          aria-label={t('instructor.searchAria')}
        />
        <SelectField id="grade-cohort" label={t('instructor.filterCohort')} value={cohortId} onChange={(e) => setCohortId(e.target.value)}>
          <option value="">{tCommon('status.all')}</option>
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={t('instructor.stats.cohortAverage')} value={String(avg)} icon={Sigma} />
        <StatCard
          label={t('instructor.stats.passRate')}
          value={rows.length ? `${Math.round((pass / rows.length) * 100)}%` : '—'}
          icon={TrendingUp}
        />
        <StatCard label={t('instructor.stats.students')} value={String(rows.length)} icon={Users} />
        <StatCard label={t('instructor.stats.topScore')} value={top} icon={BarChart3} />
      </AdminStatsGrid>
      <SectionCard title={<>{t('instructor.sectionTitle')}</>}>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            emptyTitle={isError ? tCommon('errors.generic') : t('instructor.empty.title')}
            emptyDescription={isError ? String(error?.message ?? '') : t('instructor.empty.description')}
            columns={[
              { key: 'student', label: t('instructor.table.student'), render: (r) => r.student?.full_name ?? '—' },
              { key: 'assessment', label: t('instructor.table.assessment'), render: (r) => r.assessment?.title ?? '—' },
              { key: 'score', label: t('instructor.table.score'), render: (r) => (r.score != null ? String(r.score) : '—') },
              {
                key: 'is_final',
                label: t('instructor.table.status'),
                render: (r) => (r.is_final ? statusLabelAr('published', locale) : statusLabelAr('draft', locale)),
              },
            ]}
            rows={rows}
          />
        )}
      </SectionCard>
    </div>
  );
}
