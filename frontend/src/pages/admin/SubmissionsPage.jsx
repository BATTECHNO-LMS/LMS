import { useMemo, useState } from 'react';
import { Inbox, Clock, CheckCircle2 } from 'lucide-react';
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
import { useSubmissions } from '../../features/submissions/index.js';
import { statusLabelAr } from '../../utils/statusMap.js';
import { useLocale } from '../../features/locale/index.js';

export function SubmissionsPage() {
  const { t } = useTranslation('submissions');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  const params = useMemo(() => {
    const p = {};
    const s = q.trim();
    if (s) p.search = s;
    if (status) p.status = status;
    return p;
  }, [q, status]);

  const { data, isLoading, isError, error } = useSubmissions(params, { staleTime: 30_000 });
  const rows = data?.submissions ?? [];
  const pending = useMemo(() => rows.filter((r) => r.status === 'submitted' || r.status === 'late').length, [rows]);
  const done = useMemo(() => rows.filter((r) => r.status === 'graded').length, [rows]);

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
        <SelectField id="sub-status" label={t('instructor.table.status')} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{tCommon('status.allStatuses')}</option>
          <option value="draft">{statusLabelAr('draft', locale)}</option>
          <option value="submitted">{t('states.submitted')}</option>
          <option value="late">{t('states.late')}</option>
          <option value="resubmitted">{t('states.resubmitted', { defaultValue: 'Resubmitted' })}</option>
          <option value="graded">{t('states.graded')}</option>
          <option value="returned">{t('states.returned', { defaultValue: 'Returned' })}</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={t('instructor.stats.awaitingReview')} value={String(pending)} icon={Clock} />
        <StatCard label={t('instructor.stats.graded')} value={String(done)} icon={CheckCircle2} />
        <StatCard label={t('instructor.stats.late')} value={String(rows.filter((r) => r.status === 'late').length)} icon={Inbox} />
        <StatCard label={t('instructor.stats.total')} value={String(rows.length)} icon={Inbox} />
      </AdminStatsGrid>
      <SectionCard title={<>{t('instructor.sectionTitle')}</>}>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            emptyTitle={isError ? tCommon('errors.generic') : t('instructor.empty.title')}
            emptyDescription={isError ? String(error?.message ?? '') : t('instructor.empty.description')}
            columns={[
              { key: 'student', label: t('instructor.table.studentName'), render: (r) => r.student?.full_name ?? '—' },
              { key: 'assessment', label: t('instructor.table.assessmentName'), render: (r) => r.assessment?.title ?? '—' },
              {
                key: 'submitted_at',
                label: t('instructor.table.submittedAt'),
                render: (r) => (r.submitted_at ? String(r.submitted_at).slice(0, 19) : '—'),
              },
              {
                key: 'status',
                label: t('instructor.table.status'),
                render: (r) => statusLabelAr(r.status, locale),
              },
            ]}
            rows={rows}
          />
        )}
      </SectionCard>
    </div>
  );
}
