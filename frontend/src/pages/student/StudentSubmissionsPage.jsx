import { Eye, Upload, Pencil } from 'lucide-react';
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
import { AssessmentTypeBadge } from '../../components/assessment/AssessmentTypeBadge.jsx';
import { SubmissionStatusBadge } from '../../components/assessment/SubmissionStatusBadge.jsx';
import { Upload as UploadIcon, CheckCircle2, XCircle, History } from 'lucide-react';
import { STUDENT_SUBMISSION_ROWS } from '../../mocks/instructorAssessmentWorkspace.js';
import { useTenant } from '../../features/tenant/index.js';

export function StudentSubmissionsPage() {
  const { t } = useTranslation('submissions');
  const { t: tCommon } = useTranslation('common');
  const { filterRows, scopeId } = useTenant();
  const rows = useMemo(() => filterRows(STUDENT_SUBMISSION_ROWS), [filterRows, scopeId]);
  const P = UI_PERMISSION;

  return (
    <PagePermissionGate permission={P.canViewSubmissionStatus}>
      <div className="page page--dashboard page--student">
        <AdminPageHeader title={<>{t('student.title')}</>} description={<>{t('student.description')}</>} />
        <AdminFilterBar>
          <SearchInput placeholder={t('student.searchPlaceholder')} aria-label={t('student.searchAria')} />
        </AdminFilterBar>
        <AdminStatsGrid>
          <StatCard label={t('student.stats.accepted')} value="—" icon={CheckCircle2} />
          <StatCard label={t('student.stats.needsRedo')} value="—" icon={XCircle} />
          <StatCard label={t('student.stats.history')} value="—" icon={History} />
          <StatCard label={t('student.stats.total')} value="—" icon={UploadIcon} />
        </AdminStatsGrid>
        <SectionCard title={<>{t('student.sectionTitle')}</>}>
          <DataTable
            emptyTitle={t('student.empty.title')}
            emptyDescription={t('student.empty.description')}
            columns={[
              { key: 'assessmentName', label: t('student.table.assessmentName') },
              {
                key: 'type',
                label: t('student.table.type'),
                render: (r) => <AssessmentTypeBadge type={r.type} />,
              },
              { key: 'submittedAt', label: t('student.table.submittedAt') },
              {
                key: 'state',
                label: t('student.table.state'),
                render: (r) => <SubmissionStatusBadge state={r.state} />,
              },
              { key: 'score', label: t('student.table.score') },
              {
                key: 'actions',
                label: tCommon('table.actions'),
                render: (r) => (
                  <div className="table-row-actions">
                    <PermissionGate permission={P.canViewSubmissionStatus}>
                      <button
                        type="button"
                        className="btn btn--icon btn--ghost"
                        title={t('student.actions.view')}
                        aria-label={t('student.actions.view')}
                      >
                        <Eye size={18} />
                      </button>
                    </PermissionGate>
                    <PermissionGate permission={P.canSubmitAssessments}>
                      {r.state === 'late' || r.state === 'open' ? (
                        <button
                          type="button"
                          className="btn btn--icon btn--ghost"
                          title={t('student.actions.upload')}
                          aria-label={t('student.actions.upload')}
                        >
                          <Upload size={18} />
                        </button>
                      ) : null}
                    </PermissionGate>
                    <PermissionGate permission={P.canEditOwnSubmission}>
                      {r.state === 'submitted' ? (
                        <button
                          type="button"
                          className="btn btn--icon btn--ghost"
                          title={t('student.actions.edit')}
                          aria-label={t('student.actions.edit')}
                        >
                          <Pencil size={18} />
                        </button>
                      ) : null}
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
