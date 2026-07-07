import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  Clock,
  GraduationCap,
  ListChecks,
  Mail,
  Search,
  Users,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/common/Button.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { FormTextarea } from '../../../components/forms/FormTextarea.jsx';
import {
  useAdminFieldTraining,
  useOpportunityApplications,
  useReviewApplication,
  applicationBadgeVariant,
  trainingStatusVariant,
  computeApplicationStats,
  displayFieldValue,
  formatFtDate,
  getOpportunitySpecialtyLabel,
  getStudentInitials,
  opportunityStatusVariant,
  expelFieldTrainingParticipant,
  issueCompletionLetter,
  useApplicationProgress,
} from '../../../features/fieldTraining/index.js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fieldTrainingKeys } from '../../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

const FILTER_TABS = ['all', 'pending', 'approved', 'rejected'];

function ApplicationsPageSkeleton() {
  return (
    <div className="ft-apps-page" aria-busy="true" aria-label="Loading">
      <div className="ft-detail-skeleton ft-detail-skeleton--hero" />
      <div className="ft-apps-kpi-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="ft-detail-skeleton ft-detail-skeleton--kpi" />
        ))}
      </div>
      <div className="ft-detail-skeleton ft-detail-skeleton--toolbar" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="ft-detail-skeleton ft-detail-skeleton--review-card" />
      ))}
    </div>
  );
}

function KpiStatCard({ icon: Icon, value, label, hint, tone }) {
  return (
    <div className={`ft-apps-kpi ft-apps-kpi--${tone}`}>
      <div className="ft-apps-kpi__icon-wrap" aria-hidden>
        <Icon size={20} />
      </div>
      <div className="ft-apps-kpi__body">
        <span className="ft-apps-kpi__value">{value}</span>
        <span className="ft-apps-kpi__label">{label}</span>
        <span className="ft-apps-kpi__hint">{hint}</span>
      </div>
    </div>
  );
}

function ApplicationReviewCard({
  app,
  t,
  i18n,
  onApprove,
  onReject,
  onExpel,
  onIssueLetter,
  onViewProgress,
  reviewPending,
  actionPending,
}) {
  const studentName = displayFieldValue(app.student_name, t('missingStudentName'));
  const studentEmail = displayFieldValue(app.student_email, t('missingStudentEmail'));
  const studentUniversity = displayFieldValue(app.student_university, t('missingStudentUniversity'));
  const studentSpecialty = getOpportunitySpecialtyLabel(
    { specialty: app.student_specialty },
    i18n.language,
    t('missingStudentSpecialty')
  );
  const isPending = app.status === 'pending';
  const statusTone = app.status === 'cancelled' ? 'muted' : app.status;

  return (
    <article className={`ft-review-card ft-review-card--${statusTone}`}>
      <div className="ft-review-card__identity">
        <div className="ft-review-card__avatar" aria-hidden>
          {getStudentInitials(app.student_name)}
        </div>
        <div className="ft-review-card__identity-text">
          <div className="ft-review-card__name-row">
            <h3 className="ft-review-card__name">{studentName}</h3>
            <StatusBadge variant={applicationBadgeVariant(app.status)}>
              {t(`applicationStatus.${app.status}`)}
            </StatusBadge>
          </div>
          <p className="ft-review-card__email">
            <Mail size={14} aria-hidden />
            {studentEmail}
          </p>
          <div className="ft-review-card__tags">
            <span className="ft-review-card__tag">
              <GraduationCap size={13} aria-hidden />
              {studentUniversity}
            </span>
            <span className="ft-review-card__tag">
              <Briefcase size={13} aria-hidden />
              {studentSpecialty}
            </span>
          </div>
        </div>
      </div>

      <div className="ft-review-card__meta">
        <p className="ft-review-card__date">
          <Clock size={14} aria-hidden />
          {t('table.appliedAt')}: {formatFtDate(app.created_at) ?? t('student.dateNotSet')}
        </p>
        {app.reviewed_at ? (
          <p className="ft-review-card__date">
            {t('table.reviewedAt')}: {formatFtDate(app.reviewed_at)}
          </p>
        ) : null}
        {app.student_message ? (
          <div className="ft-review-card__quote">
            <span className="ft-review-card__quote-title">{t('studentMessageTitle')}</span>
            <p>{app.student_message}</p>
          </div>
        ) : isPending ? (
          <p className="ft-review-card__muted">{t('noStudentMessage')}</p>
        ) : null}
        {app.admin_note ? (
          <div className="ft-review-card__note">
            <span className="ft-review-card__note-title">{t('adminNoteTitle')}</span>
            <p>{app.admin_note}</p>
          </div>
        ) : null}
        {app.training_status && app.training_status !== 'none' ? (
          <div className="ft-review-card__progress">
            <StatusBadge variant={trainingStatusVariant(app.training_status)}>
              {t(`trainingStatus.${app.training_status}`, app.training_status)}
            </StatusBadge>
            {app.pre_assessment_level ? (
              <span className="ft-review-card__tag">
                {t('progress.preLevel')}: {t(`knowledgeLevel.${app.pre_assessment_level}`)}
              </span>
            ) : null}
            {app.attendance_percentage != null ? (
              <span className="ft-review-card__tag">
                {t('progress.attendance')}: {app.attendance_percentage}%
              </span>
            ) : null}
            {app.post_assessment_score != null ? (
              <span className="ft-review-card__tag">
                {t('progress.postScore')}: {app.post_assessment_score}%
              </span>
            ) : null}
            {app.final_task_status && app.final_task_status !== 'not_required' ? (
              <span className="ft-review-card__tag">
                {t('progress.task')}: {t(`finalTaskStatus.${app.final_task_status}`)}
              </span>
            ) : null}
            {app.completion_letter_issued_at ? (
              <span className="ft-review-card__tag ft-review-card__tag--success">
                {t('progress.letterIssued')}
              </span>
            ) : null}
            {app.training_status === 'expelled' ? (
              <span className="ft-review-card__tag ft-review-card__tag--danger">
                {t('trainingStatus.expelled')}
              </span>
            ) : null}
            {app.completion_eligibility_status ? (
              <span className="ft-review-card__tag">
                {t('progress.eligibility')}: {t(`eligibility.${app.completion_eligibility_status}`)}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="ft-review-card__actions">
        {isPending ? (
          <>
            <Button
              type="button"
              variant="primary"
              className="ft-review-card__btn ft-review-card__btn--approve"
              disabled={reviewPending}
              onClick={() => onApprove(app.id)}
            >
              <CheckCircle2 size={16} aria-hidden />
              {t('approveApplication')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="ft-review-card__btn ft-review-card__btn--reject"
              disabled={reviewPending}
              onClick={() => onReject(app.id)}
            >
              <XCircle size={16} aria-hidden />
              {t('rejectApplication')}
            </Button>
          </>
        ) : (
          <div className="ft-review-card__readonly ft-review-card__actions-row">
            <StatusBadge variant={applicationBadgeVariant(app.status)}>
              {t(`applicationStatus.${app.status}`)}
            </StatusBadge>
            {app.status === 'approved' && app.training_status !== 'expelled' ? (
              <>
                <Button type="button" variant="outline" onClick={() => onViewProgress(app)}>
                  {t('viewProgress')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={actionPending}
                  onClick={() => onExpel(app)}
                >
                  {t('expel.action')}
                </Button>
                {app.completion_eligibility_status === 'eligible' ? (
                  <Button
                    type="button"
                    variant="primary"
                    disabled={actionPending}
                    onClick={() => onIssueLetter(app.id)}
                  >
                    {t('completionLetter.issue')}
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        )}
      </div>
    </article>
  );
}

export function AdminFieldTrainingApplicationsPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation('fieldTraining');
  const { data: oppData, isLoading: oppLoading } = useAdminFieldTraining(id);
  const { data, isLoading, isError, refetch } = useOpportunityApplications(id);
  const reviewMut = useReviewApplication(id);
  const qc = useQueryClient();
  const [reviewModal, setReviewModal] = useState(null);
  const [expelModal, setExpelModal] = useState(null);
  const [expelReason, setExpelReason] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [progressModal, setProgressModal] = useState(null);

  const applications = data?.applications ?? [];
  const opp = oppData?.opportunity;
  const stats = useMemo(() => computeApplicationStats(applications), [applications]);
  const specialtyLabel = getOpportunitySpecialtyLabel(opp, i18n.language, t('form.specialtyUnspecified'));

  const filteredApplications = useMemo(() => {
    let list = applications;
    if (activeTab !== 'all') {
      list = list.filter((a) => a.status === activeTab);
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((a) => {
      const spec = getOpportunitySpecialtyLabel(
        { specialty: a.student_specialty },
        i18n.language,
        ''
      );
      return [a.student_name, a.student_email, a.student_university, spec].some((field) =>
        String(field ?? '').toLowerCase().includes(q)
      );
    });
  }, [applications, activeTab, search, i18n.language]);

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

  const expelMut = useMutation({
    mutationFn: ({ applicationId, reason }) =>
      expelFieldTrainingParticipant(applicationId, { reason, notifyStudent: true }),
    onSuccess: () => {
      setExpelModal(null);
      setExpelReason('');
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.adminApplications(id) });
    },
  });

  const issueMut = useMutation({
    mutationFn: (applicationId) => issueCompletionLetter(applicationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: fieldTrainingKeys.adminApplications(id) }),
  });

  const actionPending = expelMut.isPending || issueMut.isPending;

  if (oppLoading || isLoading) {
    return (
      <div className="page page--dashboard page--admin ft-page">
        <ApplicationsPageSkeleton />
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin ft-page">
      <div className="ft-apps-page">
        <section className="ft-apps-hero" aria-labelledby="ft-apps-hero-title">
          <div className="ft-apps-hero__pattern" aria-hidden />
          <div className="ft-apps-hero__accent" aria-hidden />
          <div className="ft-apps-hero__inner">
            <div className="ft-apps-hero__content">
              <p className="ft-apps-hero__eyebrow">{t('applicationsSubtitle')}</p>
              <div className="ft-apps-hero__title-row">
                <h1 id="ft-apps-hero-title" className="ft-apps-hero__title">
                  {opp?.title ?? t('applicationsTitle')}
                </h1>
                {opp?.status ? (
                  <StatusBadge variant={opportunityStatusVariant(opp.status)}>
                    {t(`status.${opp.status}`)}
                  </StatusBadge>
                ) : null}
              </div>
              <p className="ft-apps-hero__specialty">
                <GraduationCap size={16} aria-hidden />
                {specialtyLabel}
              </p>
            </div>
            <div className="ft-apps-hero__actions">
              <Link className="btn btn--outline btn--sm" to="/admin/field-training">
                <ArrowLeft size={16} aria-hidden />
                {t('backToList')}
              </Link>
              <Link className="btn btn--outline btn--sm" to={`/admin/field-training/${id}/manage`}>
                {t('manageTraining.link')}
              </Link>
              <Link className="btn btn--primary btn--sm" to={`/admin/field-training/${id}/tasks`}>
                <ListChecks size={16} aria-hidden />
                {t('tasks.manageTasks')}
              </Link>
            </div>
          </div>
        </section>

        <div className="ft-apps-kpi-grid" role="list">
          <KpiStatCard
            icon={Users}
            value={stats.total}
            label={t('adminKpi.totalApplications')}
            hint={t('adminKpi.totalApplicationsHint')}
            tone="navy"
          />
          <KpiStatCard
            icon={Clock}
            value={stats.pending}
            label={t('adminKpi.pendingApplications')}
            hint={t('adminKpi.pendingApplicationsHint')}
            tone="pending"
          />
          <KpiStatCard
            icon={CheckCircle2}
            value={stats.approved}
            label={t('adminKpi.approvedApplications')}
            hint={t('adminKpi.approvedApplicationsHint')}
            tone="approved"
          />
          <KpiStatCard
            icon={XCircle}
            value={stats.rejected}
            label={t('adminKpi.rejectedApplications')}
            hint={t('adminKpi.rejectedApplicationsHint')}
            tone="rejected"
          />
        </div>

        <section className="ft-apps-toolbar" aria-label={t('applicationsTitle')}>
          <div className="ft-apps-toolbar__head">
            <div>
              <h2 className="ft-apps-toolbar__title">{t('applicationsTitle')}</h2>
              <p className="ft-apps-toolbar__count">{t('applicationsCount', { count: applications.length })}</p>
            </div>
            <div className="ft-admin-search ft-apps-toolbar__search">
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
          </div>
          <div className="ft-chips" role="tablist">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                className={`ft-chip${activeTab === tab ? ' ft-chip--active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'all' ? t('filterAllApplications') : t(`applicationStatus.${tab}`)}
              </button>
            ))}
          </div>
        </section>

        {isError ? (
          <div className="ft-detail-error" role="alert">
            <div className="ft-detail-error__icon-wrap" aria-hidden>
              <Users size={28} />
            </div>
            <h2 className="ft-detail-error__title">{t('applicationsLoadErrorTitle')}</h2>
            <Button type="button" variant="primary" onClick={() => refetch()}>
              {t('retryLoad')}
            </Button>
          </div>
        ) : null}

        {!isError && !applications.length ? (
          <div className="ft-empty ft-empty--premium">
            <Users size={48} aria-hidden />
            <h3>{t('noApplicationsTitle')}</h3>
            <p>{t('noApplications')}</p>
          </div>
        ) : null}

        {!isError && applications.length > 0 && !filteredApplications.length ? (
          <div className="ft-empty ft-empty--premium">
            <Search size={40} aria-hidden />
            <h3>{t('applicationsFilteredEmptyTitle')}</h3>
            <p>{t('applicationsFilteredEmptyDesc')}</p>
          </div>
        ) : null}

        {!isError && filteredApplications.length > 0 ? (
          <div className="ft-review-list">
            {filteredApplications.map((app) => (
              <ApplicationReviewCard
                key={app.id}
                app={app}
                t={t}
                i18n={i18n}
                reviewPending={reviewMut.isPending}
                onApprove={(applicationId) => {
                  setReviewModal({ applicationId, status: 'approved' });
                  setAdminNote('');
                }}
                onReject={(applicationId) => {
                  setReviewModal({ applicationId, status: 'rejected' });
                  setAdminNote('');
                }}
                onExpel={(appRow) => {
                  setExpelModal(appRow);
                  setExpelReason('');
                }}
                onIssueLetter={(applicationId) => issueMut.mutate(applicationId)}
                onViewProgress={(appRow) => setProgressModal(appRow)}
                actionPending={actionPending}
              />
            ))}
          </div>
        ) : null}
      </div>

      {reviewModal ? (
        <div className="ft-modal-backdrop" onClick={() => setReviewModal(null)} role="presentation">
          <div
            className="ft-modal ft-modal--review"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ft-review-modal-title"
          >
            <header className="ft-modal__header">
              <div className="ft-modal__header-text">
                <h2 id="ft-review-modal-title" className="ft-modal__title">
                  {reviewModal.status === 'approved' ? t('reviewApproveTitle') : t('reviewRejectTitle')}
                </h2>
                <p className="ft-modal__subtitle">{t('adminNote')}</p>
              </div>
            </header>
            <div className="ft-modal__body">
              <FormTextarea
                id="review-note"
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
                className={reviewModal.status === 'approved' ? 'ft-review-card__btn--approve' : 'ft-review-card__btn--reject'}
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
              <h2 className="ft-modal__title">{t('expel.title')}</h2>
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
                {t('expel.confirm')}
              </Button>
            </footer>
          </div>
        </div>
      ) : null}

      {progressModal ? (
        <ProgressModal app={progressModal} onClose={() => setProgressModal(null)} />
      ) : null}
    </div>
  );
}

function ProgressModal({ app, onClose }) {
  const { t } = useTranslation('fieldTraining');
  const { data, isLoading } = useApplicationProgress(app.id);

  return (
    <div className="ft-modal-backdrop" onClick={onClose} role="presentation">
      <div className="ft-modal ft-modal--wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="ft-modal__header">
          <h2 className="ft-modal__title">{t('viewProgress')}</h2>
          <p className="ft-modal__subtitle">{app.student_name}</p>
        </header>
        <div className="ft-modal__body">
          {isLoading ? <p>{t('loading')}</p> : null}
          {data?.progress?.steps?.map((step) => (
            <div key={step.key} className="ft-progress-step">
              <strong>{t(`progressSteps.${step.key}`, step.key)}</strong>
              <span>{t(`stepStatus.${step.status}`, step.status)}</span>
            </div>
          ))}
          {data?.progress?.metrics ? (
            <div className="ft-eligibility-card">
              <h3>{t('progress.eligibility')}</h3>
              <p>
                {t(`eligibility.${data.progress.metrics.completion_eligibility_status || 'pending'}`)}
              </p>
              <ul>
                <li>
                  {t('progress.attendance')}: {data.progress.metrics.attendance_percentage ?? '—'}%
                </li>
                <li>
                  {t('progress.postScore')}: {data.progress.metrics.post_assessment_score ?? '—'}
                </li>
              </ul>
            </div>
          ) : null}
        </div>
        <footer className="ft-modal__footer">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
        </footer>
      </div>
    </div>
  );
}
