import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Search, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../../../components/common/Button.jsx';
import { FormTextarea } from '../../../../../components/forms/FormTextarea.jsx';
import {
  useOpportunityApplications,
  useReviewApplication,
  expelFieldTrainingParticipant,
  requestFieldTrainingExpulsion,
} from '../../../../../features/fieldTraining/index.js';
import { fieldTrainingKeys } from '../../../../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';
import { getApiErrorMessage } from '../../../../../services/apiHelpers.js';
import { useDebouncedValue } from '../../../../../hooks/useDebouncedValue.js';
import { ManageTabEmpty, ManageTabError, ManageTabSkeleton } from './ManageTabStates.jsx';
import { StudentApplicationCard } from './StudentApplicationCard.jsx';
import { StudentDetailDrawer } from './StudentDetailDrawer.jsx';

const FILTER_TABS = ['all', 'pending', 'approved', 'rejected'];

export function ManageApplicationsTab({ opportunityId, apiScope = 'admin' }) {
  const isInstructor = apiScope === 'instructor';
  const listBase = isInstructor ? '/instructor/field-training' : '/admin/field-training';
  const { t, i18n } = useTranslation('fieldTraining');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 400);
  const [filterTab, setFilterTab] = useState(isInstructor ? 'approved' : 'all');
  const [reviewModal, setReviewModal] = useState(null);
  const [expelModal, setExpelModal] = useState(null);
  const [expelReason, setExpelReason] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [selectedApp, setSelectedApp] = useState(null);
  const [actionError, setActionError] = useState('');

  const listParams = useMemo(() => {
    const params = {};
    if (filterTab !== 'all') params.status = filterTab;
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    return params;
  }, [filterTab, debouncedSearch]);

  const { data, isLoading, isError, error, refetch, isFetching } = useOpportunityApplications(
    opportunityId,
    listParams,
    { enabled: Boolean(opportunityId), scope: apiScope }
  );
  const reviewMut = useReviewApplication(opportunityId);
  const qc = useQueryClient();

  const applications = data?.applications ?? [];

  const expelMut = useMutation({
    mutationFn: ({ applicationId, reason }) =>
      isInstructor
        ? requestFieldTrainingExpulsion(applicationId, { reason })
        : expelFieldTrainingParticipant(applicationId, { reason }),
    onSuccess: () => {
      setExpelModal(null);
      setExpelReason('');
      setSelectedApp(null);
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.adminApplications(opportunityId) });
    },
    onError: (err) => setActionError(getApiErrorMessage(err)),
  });

  async function confirmReview() {
    if (!reviewModal || isInstructor) return;
    setActionError('');
    try {
      await reviewMut.mutateAsync({
        applicationId: reviewModal.applicationId,
        body: { status: reviewModal.status, admin_note: adminNote.trim() || null },
      });
      setAdminNote('');
      setReviewModal(null);
      setSelectedApp(null);
      refetch();
    } catch (err) {
      setActionError(getApiErrorMessage(err));
    }
  }

  if (isLoading) return <ManageTabSkeleton rows={4} />;
  if (isError) {
    return <ManageTabError message={getApiErrorMessage(error)} onRetry={() => refetch()} />;
  }

  return (
    <div className="ft-manage-panel">
      <header className="ft-manage-panel__head">
        <div>
          <h2 className="ft-manage-panel__title">
            {isInstructor ? t('manageHub.tabs.applications') : t('applicationsTitle')}
          </h2>
          <p className="ft-manage-panel__desc">
            {isInstructor ? t('manageHub.participantsDesc') : t('manageHub.applicationsDesc')}
          </p>
        </div>
        <Button
          as={Link}
          to={
            isInstructor
              ? `${listBase}/${opportunityId}/participants`
              : `${listBase}/${opportunityId}/applications`
          }
          variant="outline"
          className="btn--sm"
        >
          <ExternalLink size={14} aria-hidden />
          {t('manageHub.openFullPage')}
        </Button>
      </header>

      <div className="ft-manage-toolbar">
        <div className="ft-admin-search">
          <Search size={16} className="ft-admin-search__icon" aria-hidden />
          <input
            type="search"
            className="ft-admin-search__input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('applicationsSearchPlaceholder')}
            aria-label={t('applicationsSearchPlaceholder')}
          />
        </div>
        <div className="ft-chips" role="tablist">
          {FILTER_TABS.filter((tab) => !(isInstructor && tab === 'pending')).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={filterTab === tab}
              className={`ft-chip${filterTab === tab ? ' ft-chip--active' : ''}`}
              onClick={() => setFilterTab(tab)}
            >
              {tab === 'all' ? t('filterAllApplications') : t(`applicationStatus.${tab}`)}
            </button>
          ))}
        </div>
      </div>

      {actionError ? <p className="form-field__error">{actionError}</p> : null}
      {isFetching && !isLoading ? (
        <p className="ft-manage-panel__desc" role="status">
          {t('loading')}
        </p>
      ) : null}

      {!applications.length ? (
        <ManageTabEmpty
          icon={Users}
          title={t('noApplicationsTitle')}
          description={t('noApplications')}
        />
      ) : (
        <div className="ft-student-card-grid">
          {applications.map((app) => (
            <StudentApplicationCard
              key={app.id}
              app={app}
              t={t}
              i18n={i18n}
              readOnly={isInstructor}
              onOpen={setSelectedApp}
              onApprove={(applicationId) => {
                setReviewModal({ applicationId, status: 'approved' });
                setAdminNote('');
              }}
              onReject={(applicationId) => {
                setReviewModal({ applicationId, status: 'rejected' });
                setAdminNote('');
              }}
              onExpel={(row) => {
                setExpelModal(row);
                setExpelReason('');
              }}
            />
          ))}
        </div>
      )}

      <StudentDetailDrawer
        open={Boolean(selectedApp)}
        app={selectedApp}
        opportunityId={opportunityId}
        apiScope={apiScope}
        readOnly={isInstructor}
        onClose={() => setSelectedApp(null)}
        onApprove={(applicationId) => {
          setReviewModal({ applicationId, status: 'approved' });
          setAdminNote('');
        }}
        onReject={(applicationId) => {
          setReviewModal({ applicationId, status: 'rejected' });
          setAdminNote('');
        }}
        onExpel={(row) => {
          setExpelModal(row);
          setExpelReason('');
        }}
      />

      {reviewModal ? (
        <div className="ft-modal-backdrop" onClick={() => setReviewModal(null)} role="presentation">
          <div className="ft-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <header className="ft-modal__header">
              <h2 className="ft-modal__title">
                {reviewModal.status === 'approved' ? t('reviewApproveTitle') : t('reviewRejectTitle')}
              </h2>
            </header>
            <div className="ft-modal__body">
              <FormTextarea
                id="manage-review-note"
                label={t('adminNote')}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={4}
              />
            </div>
            <footer className="ft-modal__footer">
              <Button type="button" variant="outline" onClick={() => setReviewModal(null)}>
                {t('cancel')}
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={reviewMut.isPending}
                onClick={confirmReview}
              >
                {reviewMut.isPending ? t('saving') : t('reviewConfirm')}
              </Button>
            </footer>
          </div>
        </div>
      ) : null}

      {expelModal ? (
        <div className="ft-modal-backdrop" onClick={() => setExpelModal(null)} role="presentation">
          <div className="ft-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <header className="ft-modal__header">
              <h2 className="ft-modal__title">
                {isInstructor ? t('expel.requestTitle') : t('expel.title')}
              </h2>
              <p className="ft-modal__subtitle">{expelModal.student_name}</p>
            </header>
            <div className="ft-modal__body">
              <FormTextarea
                label={t('expel.reasonLabel')}
                value={expelReason}
                onChange={(e) => setExpelReason(e.target.value)}
                rows={4}
              />
            </div>
            <footer className="ft-modal__footer">
              <Button type="button" variant="outline" onClick={() => setExpelModal(null)}>
                {t('cancel')}
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={!expelReason.trim() || expelMut.isPending}
                onClick={() =>
                  expelMut.mutate({ applicationId: expelModal.id, reason: expelReason.trim() })
                }
              >
                {isInstructor ? t('expel.requestConfirm') : t('expel.confirm')}
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
