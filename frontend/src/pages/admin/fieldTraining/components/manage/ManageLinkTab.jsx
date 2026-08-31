import { useEffect, useMemo, useRef, useState } from 'react';
import { Award, Download, RefreshCw, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../../../components/common/Button.jsx';
import { StatusBadge } from '../../../../../components/admin/StatusBadge.jsx';
import { ConfirmationModal } from '../../../../../components/designSystem/ConfirmationModal.jsx';
import { AlertBanner } from '../../../../../components/designSystem/AlertBanner.jsx';
import {
  downloadAdminCompletionLetter,
  fetchCompletionLetters,
  previewBulkCompletionLetters,
  startBulkCompletionLetters,
  fetchBulkCompletionLetterJob,
  retryBulkCompletionLetters,
  downloadAllCompletionLetters,
  issueCompletionLetter,
  trainingStatusVariant,
  TaskProgressBadge,
} from '../../../../../features/fieldTraining/index.js';
import { fieldTrainingKeys } from '../../../../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';
import { getApiErrorMessage } from '../../../../../services/apiHelpers.js';
import { ManageTabEmpty, ManageTabError, ManageTabSkeleton } from './ManageTabStates.jsx';

const PAGE_SIZE = 20;

export function ManageCompletionTab({ opportunityId, opportunity = null }) {
  const { t } = useTranslation('fieldTraining');
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [issuanceStatus, setIssuanceStatus] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [banner, setBanner] = useState(null);
  const [unissuedWarning, setUnissuedWarning] = useState(null);
  const lastJobStatus = useRef('');

  const params = useMemo(
    () => ({
      page,
      page_size: PAGE_SIZE,
      search: search.trim() || undefined,
      issuance_status: issuanceStatus || undefined,
      supervisor_id: supervisorId || undefined,
    }),
    [page, search, issuanceStatus, supervisorId]
  );

  const query = useQuery({
    queryKey: [...fieldTrainingKeys.adminApplications(opportunityId), 'completion-letters', params],
    queryFn: () => fetchCompletionLetters(opportunityId, params),
    enabled: Boolean(opportunityId),
  });

  const jobQuery = useQuery({
    queryKey: ['ft-completion-letter-job', opportunityId, jobId],
    queryFn: () => fetchBulkCompletionLetterJob(opportunityId, jobId),
    enabled: Boolean(opportunityId && jobId),
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status === 'queued' || status === 'running' ? 1500 : false;
    },
  });

  useEffect(() => {
    const status = jobQuery.data?.status;
    if (status === 'completed' || status === 'failed') {
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.adminApplications(opportunityId) });
      query.refetch();
      if (lastJobStatus.current !== `${jobQuery.data.id}:${status}`) {
        lastJobStatus.current = `${jobQuery.data.id}:${status}`;
        const progress = jobQuery.data.progress || {};
        setBanner({
          variant: progress.failed ? 'warning' : 'success',
          title: t('completionLetter.issueSummary', {
            generated: progress.newly_issued ?? 0,
            alreadyCurrent: (progress.previously_issued ?? 0) + (progress.skipped ?? 0),
            failed: progress.failed ?? 0,
          }),
        });
      }
    }
  }, [jobQuery.data, opportunityId, qc, query, t]);

  const previewMut = useMutation({
    mutationFn: () => previewBulkCompletionLetters(opportunityId, {}),
    onSuccess: (data) => {
      setPreview(data);
      setConfirmOpen(true);
    },
    onError: (err) => setBanner({ variant: 'danger', title: getApiErrorMessage(err) }),
  });

  const issueMut = useMutation({
    mutationFn: () => startBulkCompletionLetters(opportunityId, {}),
    onSuccess: (data) => {
      setConfirmOpen(false);
      setJobId(data.id);
      setBanner({ variant: 'success', title: t('completionLetter.bulkStarted') });
    },
    onError: (err) => setBanner({ variant: 'danger', title: getApiErrorMessage(err) }),
  });

  const retryMut = useMutation({
    mutationFn: () => retryBulkCompletionLetters(opportunityId, jobId),
    onSuccess: (data) => {
      setJobId(data.id);
      setBanner({ variant: 'success', title: t('completionLetter.retryStarted') });
    },
    onError: (err) => setBanner({ variant: 'danger', title: getApiErrorMessage(err) }),
  });

  const singleIssueMut = useMutation({
    mutationFn: (applicationId) => issueCompletionLetter(applicationId),
    onSuccess: () => {
      query.refetch();
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.adminApplications(opportunityId) });
    },
    onError: (err) => setBanner({ variant: 'danger', title: getApiErrorMessage(err) }),
  });

  const downloadMut = useMutation({
    mutationFn: () => downloadAllCompletionLetters(opportunityId),
    onSuccess: (data) => {
      const parts = [];
      if (data?.included) parts.push(t('completionLetter.zipIncluded', { count: data.included }));
      if (data?.failed) parts.push(t('completionLetter.zipFailed', { count: data.failed }));
      setBanner({
        variant: data?.failed ? 'warning' : 'success',
        title: parts.join(' · ') || t('completionLetter.zipReady'),
      });
    },
    onError: (err) => {
      const unissued = err?.response?.data?.error?.details?.unissued || err?.response?.data?.details?.unissued;
      if (unissued) {
        setUnissuedWarning(unissued);
        return;
      }
      setBanner({ variant: 'danger', title: getApiErrorMessage(err) });
    },
  });

  const data = query.data || {};
  const counters = data.counters || { eligible: 0, issued: 0, pending: 0, errors: 0 };
  const students = data.students || [];
  const pagination = data.pagination || { page: 1, total_pages: 1, total: 0 };
  const job = jobQuery.data;
  const issuing = Boolean(job && (job.status === 'queued' || job.status === 'running')) || issueMut.isPending;
  const supervisors = data.supervisors || [];

  if (query.isLoading) return <ManageTabSkeleton rows={4} />;
  if (query.isError) {
    return <ManageTabError message={getApiErrorMessage(query.error)} onRetry={() => query.refetch()} />;
  }

  return (
    <div className="ft-manage-panel" dir="rtl">
      <header className="ft-manage-panel__head">
        <div>
          <h2 className="ft-manage-panel__title">{t('manageHub.tabs.completion')}</h2>
          <p className="ft-manage-panel__desc">{t('manageHub.completionDesc')}</p>
        </div>
        <div className="ft-completion-toolbar">
          <Button
            type="button"
            variant="primary"
            disabled={issuing || previewMut.isPending || counters.pending === 0}
            onClick={() => previewMut.mutate()}
          >
            {issuing ? t('completionLetter.issuing') : t('completionLetter.issueAll')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={downloadMut.isPending || issuing || counters.issued === 0}
            onClick={() => {
              if (downloadMut.isPending || issuing) return;
              if (counters.pending > 0) {
                setUnissuedWarning(counters.pending);
                return;
              }
              downloadMut.mutate();
            }}
          >
            <Download size={16} aria-hidden />
            {downloadMut.isPending ? t('completionLetter.zipPreparing') : t('completionLetter.downloadAll')}
          </Button>
        </div>
      </header>

      {banner ? (
        <AlertBanner variant={banner.variant} title={banner.title} onDismiss={() => setBanner(null)} />
      ) : null}

      {job ? (
        <div className="ft-completion-progress" role="status">
          <strong>{job.progress?.status_label || t('completionLetter.issuing')}</strong>
          <span>
            {t('completionLetter.progressCounts', {
              completed: job.progress?.completed ?? 0,
              remaining: job.progress?.remaining ?? 0,
              failed: job.progress?.failed ?? 0,
            })}
          </span>
          {job.progress?.failed > 0 && job.status !== 'running' ? (
            <Button type="button" variant="outline" size="sm" disabled={retryMut.isPending} onClick={() => retryMut.mutate()}>
              <RefreshCw size={14} aria-hidden />
              {t('completionLetter.retryFailed')}
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="ft-manage-kpi-grid">
        <article className="ft-manage-kpi">
          <div>
            <span className="ft-manage-kpi__label">{t('completionLetter.eligibleCount')}</span>
            <strong className="ft-manage-kpi__value">{counters.eligible}</strong>
          </div>
        </article>
        <article className="ft-manage-kpi">
          <div>
            <span className="ft-manage-kpi__label">{t('completionLetter.issuedCount')}</span>
            <strong className="ft-manage-kpi__value">{counters.issued}</strong>
          </div>
        </article>
        <article className="ft-manage-kpi">
          <div>
            <span className="ft-manage-kpi__label">{t('completionLetter.pendingCount')}</span>
            <strong className="ft-manage-kpi__value">{counters.pending}</strong>
          </div>
        </article>
        <article className="ft-manage-kpi">
          <div>
            <span className="ft-manage-kpi__label">{t('completionLetter.errorCount')}</span>
            <strong className="ft-manage-kpi__value">{counters.errors}</strong>
          </div>
        </article>
      </div>

      <div className="ft-completion-filters admin-filter-bar">
        <label className="ft-completion-search">
          <Search size={16} aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder={t('completionLetter.searchPlaceholder')}
          />
        </label>
        <select
          value={issuanceStatus}
          onChange={(e) => {
            setPage(1);
            setIssuanceStatus(e.target.value);
          }}
        >
          <option value="">{t('completionLetter.filterIssuance')}</option>
          <option value="issued">{t('completionLetter.issuedCount')}</option>
          <option value="pending">{t('completionLetter.pendingCount')}</option>
          <option value="ineligible">{t('completionLetter.ineligible')}</option>
        </select>
        <select
          value={supervisorId}
          onChange={(e) => {
            setPage(1);
            setSupervisorId(e.target.value);
          }}
        >
          <option value="">{t('completionLetter.filterSupervisor')}</option>
          {supervisors.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      {!students.length ? (
        <ManageTabEmpty icon={Award} title={t('manageHub.noEligible')} />
      ) : (
        <ul className="ft-completion-list">
          {students.map((app) => (
            <li key={app.id} className="ft-completion-card">
              <div>
                <strong>{app.student_name}</strong>
                <p>{app.student_email}</p>
                <p className="muted">{app.university_number}</p>
                {app.academic_supervisor_name ? (
                  <p className="muted">{app.academic_supervisor_name}</p>
                ) : null}
                <StatusBadge variant={trainingStatusVariant(app.training_status)}>
                  {t(`trainingStatus.${app.training_status}`, app.training_status)}
                </StatusBadge>
                <TaskProgressBadge progress={app.task_progress} />
                {app.already_issued ? (
                  <StatusBadge variant="success">{t('completionLetter.issuedCount')}</StatusBadge>
                ) : app.skip_reason_label ? (
                  <StatusBadge variant="warning">{app.skip_reason_label}</StatusBadge>
                ) : null}
              </div>
              <div className="ft-completion-card__actions">
                {app.already_issued ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => downloadAdminCompletionLetter(app.id).catch((err) => setBanner({ variant: 'danger', title: getApiErrorMessage(err) }))}
                  >
                    <Download size={16} aria-hidden />
                    {t('completionLetter.download')}
                  </Button>
                ) : app.will_issue ? (
                  <Button
                    type="button"
                    variant="primary"
                    disabled={issuing || singleIssueMut.isPending}
                    onClick={() => singleIssueMut.mutate(app.id)}
                  >
                    {t('completionLetter.issue')}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {pagination.total_pages > 1 ? (
        <div className="ft-completion-pagination">
          <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t('completionLetter.prev')}
          </Button>
          <span>
            {pagination.page} / {pagination.total_pages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= pagination.total_pages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('completionLetter.next')}
          </Button>
        </div>
      ) : null}

      <ConfirmationModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          if (issueMut.isPending || issuing) return;
          issueMut.mutate();
        }}
        title={t('completionLetter.confirmTitle')}
        confirmLabel={t('completionLetter.issueAll')}
        cancelLabel={t('common.cancel', { defaultValue: 'إلغاء' })}
        confirmVariant="primary"
        busy={issueMut.isPending}
        size="lg"
        message={
          preview ? (
            <>
              {[
                `${t('completionLetter.confirmOpportunity')}: ${preview.opportunity_name || opportunity?.title || ''}`,
                `${t('completionLetter.confirmUniversity')}: ${preview.university_name || ''}`,
                `${t('completionLetter.confirmTotal')}: ${preview.total_students}`,
                `${t('completionLetter.eligibleCount')}: ${preview.eligible_students}`,
                `${t('completionLetter.issuedCount')}: ${preview.letters_already_issued}`,
                `${t('completionLetter.willIssue')}: ${preview.letters_to_issue}`,
                ...(preview.skipped || []).slice(0, 8).map((row) => `${row.student_name} — ${row.reason_label}`),
              ].map((line) => (
                <span key={line}>
                  {line}
                  <br />
                </span>
              ))}
            </>
          ) : null
        }
      />

      <ConfirmationModal
        open={Boolean(unissuedWarning)}
        onClose={() => setUnissuedWarning(null)}
        onConfirm={() => {
          setUnissuedWarning(null);
          downloadMut.mutate();
        }}
        title={t('completionLetter.unissuedTitle')}
        message={t('completionLetter.unissuedMessage', { count: unissuedWarning || 0 })}
        confirmLabel={t('completionLetter.downloadIssuedOnly')}
        cancelLabel={t('cancel')}
        confirmVariant="primary"
      />
    </div>
  );
}
