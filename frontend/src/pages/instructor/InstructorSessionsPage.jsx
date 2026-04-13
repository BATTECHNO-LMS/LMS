import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock } from 'lucide-react';
import { useQueries } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { useCohorts } from '../../features/cohorts/index.js';
import { fetchSessionsByCohort } from '../../features/sessions/sessions.service.js';
import { sessionsKeys } from '../../features/sessions/hooks/useSessions.js';
import { useLocale } from '../../features/locale/index.js';

export function InstructorSessionsPage() {
  const { t } = useTranslation('sessions');
  const { t: tCoh } = useTranslation('cohorts');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const [q, setQ] = useState('');

  const cohortParams = useMemo(() => {
    const p = {};
    const s = q.trim();
    if (s) p.search = s;
    return p;
  }, [q]);

  const { data: cohortsPayload, isLoading: cLoading } = useCohorts(cohortParams, { staleTime: 60_000 });
  const cohorts = cohortsPayload?.cohorts ?? [];
  const cohortIds = useMemo(() => cohorts.map((c) => c.id).slice(0, 30), [cohorts]);

  const sessionQueries = useQueries({
    queries: cohortIds.map((cid) => ({
      queryKey: sessionsKeys.byCohort(cid),
      queryFn: () => fetchSessionsByCohort(cid),
      enabled: Boolean(cid),
      staleTime: 30_000,
    })),
  });

  const sessionsLoading = sessionQueries.some((q) => q.isLoading);
  const rows = useMemo(() => {
    const out = [];
    cohortIds.forEach((cid, i) => {
      const cohort = cohorts.find((c) => c.id === cid);
      const sessions = sessionQueries[i]?.data?.sessions ?? [];
      for (const s of sessions) {
        out.push({
          id: s.id,
          topic: s.title,
          when: `${s.session_date} ${s.start_time}`,
          cohortTitle: cohort?.title ?? '',
          session_type: s.session_type,
          locale,
        });
      }
    });
    out.sort((a, b) => String(a.when).localeCompare(String(b.when)));
    return out;
  }, [cohortIds, cohorts, sessionQueries, locale]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.topic.toLowerCase().includes(s) ||
        r.cohortTitle.toLowerCase().includes(s) ||
        String(r.session_type).toLowerCase().includes(s)
    );
  }, [rows, q]);

  return (
    <div className="page page--dashboard page--instructor">
      <AdminPageHeader title={<>{t('title')}</>} description={<>{t('listTitle')}</>} />
      <AdminFilterBar>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tCommon('actions.search')}
          aria-label={tCommon('actions.search')}
        />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={t('title')} value={String(rows.length)} icon={CalendarDays} />
        <StatCard label={tCoh('stats.total')} value={String(cohorts.length)} icon={Clock} />
      </AdminStatsGrid>
      <SectionCard title={<>{t('listTitle')}</>}>
        {cLoading || sessionsLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            emptyTitle={t('empty')}
            emptyDescription=""
            columns={[
              { key: 'when', label: t('sessionDate') },
              { key: 'topic', label: t('sessionTitle') },
              { key: 'cohortTitle', label: tCoh('table.title') },
              { key: 'session_type', label: t('sessionType') },
              {
                key: 'actions',
                label: tCommon('table.actions'),
                render: (r) => (
                  <Link className="btn btn--outline" to={`/instructor/sessions/${r.id}/attendance`}>
                    {t('attendance')}
                  </Link>
                ),
              },
            ]}
            rows={filtered}
          />
        )}
      </SectionCard>
    </div>
  );
}
