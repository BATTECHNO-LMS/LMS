import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderOpen, Paperclip, Plus, Shield } from 'lucide-react';
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
import { TableIconActions } from '../../components/crud/TableIconActions.jsx';
import { useEvidence } from '../../features/evidence/index.js';
import { useCohorts } from '../../features/cohorts/index.js';
import { usePortalPathPrefix } from '../../utils/portalPathPrefix.js';

export function EvidencePage() {
  const base = usePortalPathPrefix();
  const { t } = useTranslation('evidence');
  const { t: tCommon } = useTranslation('common');
  const [q, setQ] = useState('');
  const [cohortId, setCohortId] = useState('');
  const [evidenceType, setEvidenceType] = useState('');

  const listParams = useMemo(() => {
    const p = {};
    const s = q.trim();
    if (s) p.search = s;
    if (cohortId) p.cohort_id = cohortId;
    if (evidenceType) p.evidence_type = evidenceType;
    return p;
  }, [q, cohortId, evidenceType]);

  const { data: cohortsPayload } = useCohorts({}, { staleTime: 60_000 });
  const cohorts = cohortsPayload?.cohorts ?? [];

  const { data, isLoading, isError, error } = useEvidence(listParams, { staleTime: 30_000 });
  const rows = data?.evidence ?? [];

  const stats = useMemo(() => {
    const withStudent = rows.filter((r) => r.student_id).length;
    const withAssessment = rows.filter((r) => r.assessment_id).length;
    return { total: rows.length, withStudent, withAssessment };
  }, [rows]);

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={<>{t('title')}</>} description={<>{t('description')}</>} />
      <AdminActionBar>
        <Link className="btn btn--primary" to={`${base}/evidence/create`}>
          <Plus size={18} aria-hidden /> {t('add')}
        </Link>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={tCommon('actions.search')}
        />
        <SelectField id="evidence-cohort" label={t('filters.cohort')} value={cohortId} onChange={(e) => setCohortId(e.target.value)}>
          <option value="">{t('filters.allCohorts')}</option>
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="evidence-type"
          label={t('filters.evidenceType')}
          value={evidenceType}
          onChange={(e) => setEvidenceType(e.target.value)}
        >
          <option value="">{t('filters.allTypes')}</option>
          <option value="document">document</option>
          <option value="media">media</option>
          <option value="attendance">attendance</option>
          <option value="assessment_sample">assessment_sample</option>
        </SelectField>
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={t('stats.total')} value={String(stats.total)} icon={FolderOpen} />
        <StatCard label={t('stats.withStudent')} value={String(stats.withStudent)} icon={Paperclip} />
        <StatCard label={t('stats.withAssessment')} value={String(stats.withAssessment)} icon={Shield} />
      </AdminStatsGrid>
      <SectionCard title={<>{t('listTitle')}</>}>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            emptyTitle={isError ? tCommon('errors.generic') : tCommon('emptyStates.noResultsTitle')}
            emptyDescription={isError ? String(error?.message ?? '') : tCommon('emptyStates.noResultsDescription')}
            columns={[
              { key: 'title', label: t('table.title') },
              { key: 'evidence_type', label: t('table.type') },
              { key: 'cohort', label: t('table.cohort'), render: (r) => r.cohort?.title ?? '—' },
              { key: 'micro_credential', label: t('table.microCredential'), render: (r) => r.micro_credential?.title ?? '—' },
              {
                key: 'updated_at',
                label: t('table.updated'),
                render: (r) => (r.updated_at ? String(r.updated_at).slice(0, 10) : '—'),
              },
              {
                key: 'actions',
                label: tCommon('table.actions'),
                render: (r) => <TableIconActions viewTo={`${base}/evidence/${r.id}`} editTo={`${base}/evidence/${r.id}/edit`} />,
              },
            ]}
            rows={rows}
          />
        )}
      </SectionCard>
    </div>
  );
}
