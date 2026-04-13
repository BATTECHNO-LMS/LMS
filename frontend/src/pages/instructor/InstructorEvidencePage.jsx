import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderOpen, Paperclip, ShieldCheck, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { UI_PERMISSION } from '../../constants/permissions.js';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminActionBar } from '../../components/admin/AdminActionBar.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { TableIconActions } from '../../components/crud/TableIconActions.jsx';
import { PermissionGate } from '../../components/permissions/PermissionGate.jsx';
import { useEvidence } from '../../features/evidence/index.js';
import { usePortalPathPrefix } from '../../utils/portalPathPrefix.js';

export function InstructorEvidencePage() {
  const P = UI_PERMISSION;
  const base = usePortalPathPrefix();
  const { t } = useTranslation('evidence');
  const { t: tCommon } = useTranslation('common');
  const [q, setQ] = useState('');

  const listParams = useMemo(() => {
    const p = {};
    const s = q.trim();
    if (s) p.search = s;
    return p;
  }, [q]);

  const { data, isLoading, isError, error } = useEvidence(listParams, { staleTime: 30_000 });
  const rows = data?.evidence ?? [];

  const stats = useMemo(() => {
    const withStudent = rows.filter((r) => r.student_id).length;
    return { total: rows.length, withStudent };
  }, [rows]);

  return (
    <div className="page page--dashboard page--instructor">
      <AdminPageHeader title={<>{t('title')}</>} description={<>{t('description')}</>} />
      <AdminActionBar>
        <PermissionGate permission={P.canUploadEvidence}>
          <Link className="btn btn--primary" to={`${base}/evidence/create`}>
            <Upload size={18} aria-hidden /> {t('add')}
          </Link>
        </PermissionGate>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={tCommon('actions.search')}
        />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={t('stats.total')} value={String(stats.total)} icon={FolderOpen} />
        <StatCard label={t('stats.withStudent')} value={String(stats.withStudent)} icon={Paperclip} />
        <StatCard label={t('stats.withAssessment')} value="—" icon={ShieldCheck} />
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
