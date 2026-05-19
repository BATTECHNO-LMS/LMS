import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, ListChecks } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { FormTextarea } from '../../../components/forms/FormTextarea.jsx';
import {
  useAdminFieldTraining,
  useOpportunityApplications,
  useReviewApplication,
  applicationBadgeVariant,
  computeApplicationStats,
  formatFtDate,
} from '../../../features/fieldTraining/index.js';

export function AdminFieldTrainingApplicationsPage() {
  const { id } = useParams();
  const { t } = useTranslation('fieldTraining');
  const { data: oppData, isLoading: oppLoading } = useAdminFieldTraining(id);
  const { data, isLoading, isError, refetch } = useOpportunityApplications(id);
  const reviewMut = useReviewApplication(id);
  const [reviewModal, setReviewModal] = useState(null);
  const [adminNote, setAdminNote] = useState('');

  const applications = data?.applications ?? [];
  const opp = oppData?.opportunity;
  const stats = useMemo(() => computeApplicationStats(applications), [applications]);

  async function confirmReview() {
    if (!reviewModal) return;
    await reviewMut.mutateAsync({
      applicationId: reviewModal.applicationId,
      body: { status: reviewModal.status, admin_note: adminNote.trim() || null },
    });
    setAdminNote('');
    setReviewModal(null);
    refetch();
  }

  if (oppLoading || isLoading) return <LoadingSpinner />;

  return (
    <div className="page page--dashboard page--admin ft-page">
      <div className="ft-breadcrumb-actions">
        <Link className="btn btn--ghost btn--sm" to="/admin/field-training">
          <ArrowLeft size={16} /> {t('backToList')}
        </Link>
        <Link className="btn btn--primary btn--sm" to={`/admin/field-training/${id}/tasks`}>
          <ListChecks size={16} aria-hidden /> {t('tasks.manageTasks')}
        </Link>
      </div>

      <header className="ft-detail-hero">
        <h1 className="ft-detail-hero__title">{opp?.title ?? t('applicationsTitle')}</h1>
        <p className="ft-detail-hero__org">
          <Building2 size={16} style={{ display: 'inline', verticalAlign: 'middle' }} aria-hidden />{' '}
          {opp?.organization_name ?? '—'}
        </p>
        <div className="ft-kpi-grid" style={{ marginTop: '1rem' }}>
          <div className="ft-kpi-card">
            <span className="ft-kpi-card__value">{stats.total}</span>
            <span className="ft-kpi-card__label">{t('adminKpi.totalApplications')}</span>
          </div>
          <div className="ft-kpi-card ft-kpi-card--warning">
            <span className="ft-kpi-card__value">{stats.pending}</span>
            <span className="ft-kpi-card__label">{t('adminKpi.pendingApplications')}</span>
          </div>
          <div className="ft-kpi-card ft-kpi-card--success">
            <span className="ft-kpi-card__value">{stats.approved}</span>
            <span className="ft-kpi-card__label">{t('adminKpi.approvedApplications')}</span>
          </div>
          <div className="ft-kpi-card">
            <span className="ft-kpi-card__value">{stats.rejected}</span>
            <span className="ft-kpi-card__label">{t('adminKpi.rejectedApplications')}</span>
          </div>
        </div>
      </header>

      <h2 className="ft-section-title">{t('applicationsTitle')}</h2>

      {isError ? (
        <p className="form-field__error" role="alert">
          {t('applicationsTitle')}
        </p>
      ) : null}

      {!isError && !applications.length ? (
        <div className="ft-empty">
          <h3>{t('noApplicationsTitle')}</h3>
          <p>{t('noApplications')}</p>
        </div>
      ) : null}

      {applications.map((app) => (
        <article key={app.id} className="ft-app-card">
          <header className="ft-app-card__head">
            <div>
              <h3 className="ft-app-card__name">{app.student_name ?? '—'}</h3>
              <p className="ft-app-card__email">{app.student_email ?? '—'}</p>
            </div>
            <StatusBadge variant={applicationBadgeVariant(app.status)}>
              {t(`applicationStatus.${app.status}`)}
            </StatusBadge>
          </header>
          <p className="ft-app-card__meta">
            {t('table.appliedAt')}: {formatFtDate(app.created_at) ?? '—'}
          </p>
          {app.student_message ? (
            <p className="ft-app-card__message">{app.student_message}</p>
          ) : null}
          {app.admin_note ? (
            <p className="ft-app-card__meta">
              <strong>{t('adminNote')}:</strong> {app.admin_note}
            </p>
          ) : null}
          {app.status === 'pending' ? (
            <div className="ft-app-card__actions">
              <Button
                type="button"
                variant="primary"
                className="btn--sm"
                onClick={() => {
                  setReviewModal({ applicationId: app.id, status: 'approved' });
                  setAdminNote('');
                }}
              >
                {t('approve')}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="btn--sm"
                onClick={() => {
                  setReviewModal({ applicationId: app.id, status: 'rejected' });
                  setAdminNote('');
                }}
              >
                {t('reject')}
              </Button>
            </div>
          ) : null}
        </article>
      ))}

      {reviewModal ? (
        <div className="ft-modal-backdrop" onClick={() => setReviewModal(null)} role="presentation">
          <div className="ft-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h2 className="ft-modal__title">
              {reviewModal.status === 'approved' ? t('reviewApproveTitle') : t('reviewRejectTitle')}
            </h2>
            <FormTextarea
              id="review-note"
              label={t('adminNote')}
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              rows={3}
            />
            <div className="ft-modal__actions">
              <Button type="button" variant="primary" disabled={reviewMut.isPending} onClick={confirmReview}>
                {reviewMut.isPending ? t('saving') : t('reviewConfirm')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setReviewModal(null)}>
                {t('cancel')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
