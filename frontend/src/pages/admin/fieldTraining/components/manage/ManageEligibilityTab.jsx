import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, FileArchive, Search } from 'lucide-react';
import { EmptyState } from '../../../../../components/common/EmptyState.jsx';
import { Button } from '../../../../../components/common/Button.jsx';
import { ConfirmationModal } from '../../../../../components/designSystem/ConfirmationModal.jsx';
import { AlertBanner } from '../../../../../components/designSystem/AlertBanner.jsx';
import {
  recalculateApplicationEligibility,
  useOpportunityEligibility,
  previewBulkStudentReports,
  startBulkStudentReports,
  fetchBulkStudentReportsJob,
  downloadBulkStudentReportsZip,
} from '../../../../../features/fieldTraining/index.js';
import { fieldTrainingKeys } from '../../../../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';
import { getApiErrorMessage } from '../../../../../services/apiHelpers.js';
import { ManageTabError, ManageTabSkeleton } from './ManageTabStates.jsx';
import { EligibilityStudentCard } from './EligibilityStudentCard.jsx';

const ELIGIBILITY_FILTERS = ['', 'eligible', 'ineligible', 'pending', 'needs_review', 'incomplete'];

function matchesClientFilters(row, { search, eligibilityStatus }) {
  if (eligibilityStatus && String(row.eligibility_status || '') !== eligibilityStatus) return false;
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    row.student_name,
    row.university_student_number,
    row.student_email,
    row.student_university,
  ]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');
  return hay.includes(q);
}

export function ManageEligibilityTab({ opportunityId, apiScope = 'admin' }) {
  const isInstructor = apiScope === 'instructor';
  const { t } = useTranslation('fieldTraining');
  const qc = useQueryClient();
  const [actionError, setActionError] = useState('');
  const [actionOk, setActionOk] = useState('');
  const [search, setSearch] = useState('');
  const [eligibilityStatus, setEligibilityStatus] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [banner, setBanner] = useState(null);
  const lastJobStatus = useRef('');
  const downloadInFlight = useRef(false);

  const exportFilters = useMemo(
    () => ({
      search: search.trim() || undefined,
      eligibility_status: eligibilityStatus || undefined,
    }),
    [search, eligibilityStatus]
  );

  const { data, isLoading, isError, error, refetch } = useOpportunityEligibility(opportunityId, {
    enabled: Boolean(opportunityId),
    scope: apiScope,
  });

  const jobQuery = useQuery({
    queryKey: ['ft-student-reports-bulk-job', opportunityId, apiScope, jobId],
    queryFn: () =>
      fetchBulkStudentReportsJob(opportunityId, jobId, { asInstructor: isInstructor }),
    enabled: Boolean(opportunityId && jobId),
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status === 'queued' || status === 'processing' ? 1500 : false;
    },
  });

  useEffect(() => {
    const job = jobQuery.data;
    if (!job || (job.status !== 'ready' && job.status !== 'failed')) return;
    const key = `${job.id}:${job.status}`;
    if (lastJobStatus.current === key) return;
    lastJobStatus.current = key;

    if (job.status === 'failed') {
      setBanner({
        variant: 'danger',
        title: job.error_message || t('manageHub.bulkStudentReports.failed'),
      });
      return;
    }

    if (downloadInFlight.current) return;
    downloadInFlight.current = true;
    downloadBulkStudentReportsZip(opportunityId, job.id, { asInstructor: isInstructor })
      .then((result) => {
        setBanner({
          variant: result.failed ? 'warning' : 'success',
          title: t('manageHub.bulkStudentReports.ready', {
            count: result.included || job.progress?.included || 0,
          }),
        });
      })
      .catch((err) => {
        const status = err?.response?.status;
        const code = err?.response?.data?.code;
        const authExpired =
          status === 401 || code === 'UNAUTHORIZED' || code === 'TOKEN_INVALID';
        setBanner({
          variant: 'danger',
          title: authExpired
            ? t('manageHub.bulkStudentReports.sessionExpired')
            : getApiErrorMessage(err, t('manageHub.bulkStudentReports.downloadFailed')),
        });
      })
      .finally(() => {
        downloadInFlight.current = false;
      });
  }, [jobQuery.data, opportunityId, isInstructor, t]);

  const recalcMut = useMutation({
    mutationFn: (applicationId) =>
      recalculateApplicationEligibility(applicationId, { asInstructor: isInstructor }),
    onSuccess: () => {
      setActionOk(t('manageHub.studentCards.eligibilityRecalcOk'));
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.eligibility(opportunityId, apiScope) });
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.adminApplications(opportunityId) });
    },
    onError: (err) => setActionError(getApiErrorMessage(err)),
  });

  const previewMut = useMutation({
    mutationFn: () =>
      previewBulkStudentReports(opportunityId, exportFilters, { asInstructor: isInstructor }),
    onSuccess: (payload) => {
      setPreview(payload);
      setConfirmOpen(true);
      setBanner(null);
    },
    onError: (err) =>
      setBanner({
        variant: 'danger',
        title: getApiErrorMessage(err, t('manageHub.bulkStudentReports.failed')),
      }),
  });

  const exportMut = useMutation({
    mutationFn: () =>
      startBulkStudentReports(opportunityId, exportFilters, { asInstructor: isInstructor }),
    onSuccess: (payload) => {
      setConfirmOpen(false);
      setJobId(payload.id);
      setBanner({
        variant: 'info',
        title: t('manageHub.bulkStudentReports.started'),
      });
    },
    onError: (err) =>
      setBanner({
        variant: 'danger',
        title: getApiErrorMessage(err, t('manageHub.bulkStudentReports.failed')),
      }),
  });

  const participants = data?.participants ?? [];
  const opp = data?.opportunity;
  const visibleParticipants = useMemo(
    () => participants.filter((row) => matchesClientFilters(row, { search, eligibilityStatus })),
    [participants, search, eligibilityStatus]
  );

  const exportBusy =
    previewMut.isPending ||
    exportMut.isPending ||
    jobQuery.data?.status === 'queued' ||
    jobQuery.data?.status === 'processing';
  const progress = jobQuery.data?.progress;

  if (isLoading) return <ManageTabSkeleton rows={3} />;
  if (isError) {
    return <ManageTabError message={getApiErrorMessage(error)} onRetry={() => refetch()} />;
  }

  return (
    <div className="ft-manage-panel">
      <header className="ft-manage-panel__head">
        <div>
          <h2 className="ft-manage-panel__title">{t('manageHub.tabs.eligibility')}</h2>
          <p className="ft-manage-panel__desc">{t('manageHub.eligibilityDesc')}</p>
        </div>
        <div className="ft-manage-panel__head-actions">
          <Button
            type="button"
            variant="primary"
            disabled={exportBusy || !participants.length}
            loading={previewMut.isPending || exportMut.isPending}
            aria-label={t('manageHub.bulkStudentReports.button')}
            onClick={() => {
              setActionError('');
              setActionOk('');
              previewMut.mutate();
            }}
          >
            <FileArchive size={16} aria-hidden />
            <span className="ft-bulk-export-label">{t('manageHub.bulkStudentReports.button')}</span>
          </Button>
        </div>
      </header>

      {opp ? (
        <div className="ft-eligibility-rules">
          <span>
            {t('manageHub.eligibilityRules.attendance')}:{' '}
            <strong>
              {opp.minimum_attendance_percentage != null
                ? `${opp.minimum_attendance_percentage}%`
                : t('manageHub.eligibilityRules.notSet')}
            </strong>
          </span>
          <span>
            {t('hours.required')}:{' '}
            <strong>
              {opp.required_training_hours != null
                ? `${opp.required_training_hours}`
                : t('manageHub.eligibilityRules.notSet')}
            </strong>
          </span>
          {opp.requires_final_task ? (
            <span>
              {t('manageHub.eligibilityRules.postScore')}:{' '}
              <strong>
                {opp.minimum_post_assessment_score != null
                  ? opp.minimum_post_assessment_score
                  : t('manageHub.eligibilityRules.notSet')}
              </strong>
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="ft-eligibility-toolbar">
        <label className="ft-eligibility-toolbar__search">
          <Search size={16} aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('manageHub.bulkStudentReports.searchPlaceholder')}
            aria-label={t('manageHub.bulkStudentReports.searchPlaceholder')}
          />
        </label>
        <label className="ft-eligibility-toolbar__filter">
          <span>{t('manageHub.bulkStudentReports.eligibilityFilter')}</span>
          <select
            value={eligibilityStatus}
            onChange={(event) => setEligibilityStatus(event.target.value)}
          >
            {ELIGIBILITY_FILTERS.map((value) => (
              <option key={value || 'all'} value={value}>
                {value
                  ? t(`eligibility.${value}`, value)
                  : t('manageHub.bulkStudentReports.eligibilityAll')}
              </option>
            ))}
          </select>
        </label>
        <p className="ft-eligibility-toolbar__count">
          {t('manageHub.bulkStudentReports.visibleCount', {
            visible: visibleParticipants.length,
            total: participants.length,
          })}
        </p>
      </div>

      {banner ? <AlertBanner variant={banner.variant} title={banner.title} /> : null}

      {exportBusy && progress ? (
        <p className="auth-register__helper" role="status">
          {t('manageHub.bulkStudentReports.progress', {
            completed: progress.completed ?? 0,
            total: progress.total ?? 0,
          })}
        </p>
      ) : null}

      {actionError ? <p className="form-field__error">{actionError}</p> : null}
      {actionOk ? <p className="auth-register__helper">{actionOk}</p> : null}

      {!participants.length ? (
        <EmptyState
          icon={ClipboardCheck}
          title={t('manageHub.eligibilityEmpty')}
          description={t('manageHub.eligibilityEmptyDesc')}
        />
      ) : !visibleParticipants.length ? (
        <EmptyState
          icon={ClipboardCheck}
          title={t('manageHub.bulkStudentReports.noFilterMatches')}
          description={t('manageHub.bulkStudentReports.noFilterMatchesDesc')}
        />
      ) : (
        <ul className="ft-eligibility-list">
          {visibleParticipants.map((row) => (
            <EligibilityStudentCard
              key={row.application_id}
              row={row}
              opportunity={opp}
              opportunityId={opportunityId}
              apiScope={apiScope}
              t={t}
              recalcPending={recalcMut.isPending}
              onRecalculate={(applicationId) => {
                setActionError('');
                setActionOk('');
                recalcMut.mutate(applicationId);
              }}
            />
          ))}
        </ul>
      )}

      <ConfirmationModal
        open={confirmOpen}
        onClose={() => (!exportMut.isPending ? setConfirmOpen(false) : undefined)}
        onConfirm={() => exportMut.mutate()}
        title={t('manageHub.bulkStudentReports.confirmTitle')}
        description={t('manageHub.bulkStudentReports.confirmLead')}
        message={
          <div className="ft-bulk-export-confirm">
            <p>
              {t('manageHub.bulkStudentReports.confirmCount', {
                count: preview?.matching_count ?? 0,
              })}
            </p>
            <p>
              {t('manageHub.bulkStudentReports.confirmFilters', {
                filters: preview?.filter_summary || t('manageHub.bulkStudentReports.noExtraFilters'),
              })}
            </p>
            <p>{t('manageHub.bulkStudentReports.confirmAsk')}</p>
          </div>
        }
        confirmLabel={t('manageHub.bulkStudentReports.confirmAction')}
        cancelLabel={t('common.cancel', 'إلغاء')}
        confirmVariant="primary"
        busy={exportMut.isPending}
      />
    </div>
  );
}
