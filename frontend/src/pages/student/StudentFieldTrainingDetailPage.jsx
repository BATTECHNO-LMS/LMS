import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  Briefcase,
  Calendar,
  Clock,
  FileText,
  GraduationCap,
  ListChecks,
  MapPin,
  Sparkles,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/common/Button.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import { FormTextarea } from '../../components/forms/FormTextarea.jsx';
import {
  TRAINING_MODES,
  useApplyFieldTraining,
  useCancelFieldTrainingApplication,
  useStudentFieldTraining,
  useStudentTrainingProgress,
  applicationBadgeVariant,
  formatFtDate,
  getOpportunitySpecialtyLabel,
  trainingStatusVariant,
} from '../../features/fieldTraining/index.js';
import { PagePermissionGate } from '../../components/permissions/PagePermissionGate.jsx';
import { UI_PERMISSION } from '../../constants/permissions.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';
import { StudentTrainingTabNav } from './fieldTraining/components/StudentTrainingTabNav.jsx';
import { StudentExpelledBanner } from './fieldTraining/components/StudentExpelledBanner.jsx';
import { StudentOverviewTab } from './fieldTraining/components/StudentOverviewTab.jsx';
import { StudentSessionsTab } from './fieldTraining/components/StudentSessionsTab.jsx';
import { StudentAttendanceTab } from './fieldTraining/components/StudentAttendanceTab.jsx';
import { StudentTasksTab } from './fieldTraining/components/StudentTasksTab.jsx';
import { StudentAssessmentsTab } from './fieldTraining/components/StudentAssessmentsTab.jsx';
import { StudentCompletionTab } from './fieldTraining/components/StudentCompletionTab.jsx';

const ACTIVE_TRAINING = new Set([
  'pre_assessment_completed',
  'ready_for_training',
  'in_training',
  'task_pending',
  'task_submitted',
  'post_assessment_pending',
  'post_assessment_completed',
  'eligible_for_completion',
  'completed',
]);

function getStatusSummaryKey(appStatus, expelled) {
  if (expelled) return 'expelled';
  if (!appStatus) return 'notApplied';
  if (appStatus === 'cancelled') return 'cancelled';
  return appStatus;
}

function DetailInfoCard({ icon: Icon, label, value }) {
  const display = value ?? '—';
  return (
    <div className="ft-info-card">
      <div className="ft-info-card__icon-wrap" aria-hidden>
        <Icon size={18} className="ft-info-card__icon" />
      </div>
      <div className="ft-info-card__body">
        <span className="ft-info-card__label">{label}</span>
        <span className="ft-info-card__value">{display}</span>
      </div>
    </div>
  );
}

function ContentSection({ icon: Icon, title, children, emptyFallback }) {
  const hasContent = Boolean(String(children ?? '').trim());
  return (
    <article className="ft-content-card">
      <header className="ft-content-card__head">
        <div className="ft-content-card__icon-wrap" aria-hidden>
          <Icon size={18} />
        </div>
        <h3 className="ft-content-card__title">{title}</h3>
      </header>
      <div className="ft-content-card__body">
        {hasContent ? <p>{children}</p> : <p className="ft-content-card__empty">{emptyFallback}</p>}
      </div>
    </article>
  );
}

function DetailPageSkeleton() {
  return (
    <div className="ft-student-detail" aria-busy="true" aria-label="Loading">
      <div className="ft-detail-skeleton ft-detail-skeleton--back" />
      <div className="ft-detail-skeleton ft-detail-skeleton--hero" />
      <div className="ft-detail-skeleton-grid">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="ft-detail-skeleton ft-detail-skeleton--info" />
        ))}
      </div>
      <div className="ft-detail-skeleton ft-detail-skeleton--timeline" />
      <div className="ft-detail-skeleton ft-detail-skeleton--content" />
    </div>
  );
}

function ApplicationStatusCard({
  statusKey,
  t,
  canApply,
  canCancel,
  showTrainingCta,
  onTrainingCta,
  onApply,
  onCancel,
  cancelPending,
  application,
  trainingStatus,
}) {
  const summary = t(`student.statusSummary.${statusKey}`, { returnObjects: true });

  return (
    <aside className="ft-app-status-card" aria-labelledby="ft-app-status-title">
      <div className="ft-app-status-card__accent" aria-hidden />
      <header className="ft-app-status-card__head">
        <div className="ft-app-status-card__icon-wrap" aria-hidden>
          <Sparkles size={18} />
        </div>
        <h2 id="ft-app-status-title" className="ft-app-status-card__title">
          {summary.title}
        </h2>
      </header>
      <p className="ft-app-status-card__text">{summary.text}</p>
      {application?.created_at ? (
        <p className="ft-app-status-card__meta">
          {t('studentTraining.submittedAt')}: {formatFtDate(application.created_at)}
        </p>
      ) : null}
      {application?.admin_note ? (
        <p className="ft-app-status-card__note">{application.admin_note}</p>
      ) : null}
      {trainingStatus && trainingStatus !== 'none' ? (
        <StatusBadge variant={trainingStatusVariant(trainingStatus)}>
          {t(`trainingStatus.${trainingStatus}`, trainingStatus)}
        </StatusBadge>
      ) : null}
      <div className="ft-app-status-card__actions">
        {canApply ? (
          <Button type="button" variant="primary" className="ft-app-status-card__btn" onClick={onApply}>
            {t('student.applyNow')}
          </Button>
        ) : null}
        {canCancel ? (
          <Button
            type="button"
            variant="outline"
            className="ft-app-status-card__btn ft-app-status-card__btn--danger"
            onClick={onCancel}
            disabled={cancelPending}
          >
            {t('student.cancelApplication')}
          </Button>
        ) : null}
        {showTrainingCta ? (
          <Button type="button" variant="primary" className="ft-app-status-card__btn" onClick={onTrainingCta}>
            {t('student.continueTraining')}
          </Button>
        ) : null}
      </div>
    </aside>
  );
}

export function StudentFieldTrainingDetailPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, i18n } = useTranslation('fieldTraining');
  const { t: tCommon } = useTranslation('common');
  const { data, isLoading, isError, refetch } = useStudentFieldTraining(id);
  const applyMut = useApplyFieldTraining();
  const cancelMut = useCancelFieldTrainingApplication();
  const [modalOpen, setModalOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');

  const opp = data?.opportunity;
  const application = data?.application;
  const appStatus = opp?.my_application_status;
  const appId = opp?.my_application_id ?? application?.id;
  const trainingStatus = application?.training_status ?? opp?.my_training_status ?? 'none';
  const expelled =
    trainingStatus === 'expelled' || Boolean(application?.expelled_at);
  const isApprovedParticipant = appStatus === 'approved';
  const isApproved = isApprovedParticipant && !expelled;
  const canApply = !expelled && (!appStatus || appStatus === 'cancelled');
  const canCancel = appStatus === 'pending' && appId;
  const canTrainingContent =
    isApproved && ACTIVE_TRAINING.has(trainingStatus);
  const statusKey = getStatusSummaryKey(appStatus, expelled);

  const activeTab = searchParams.get('tab') || 'overview';
  const setActiveTab = (tab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  const { data: progressData } = useStudentTrainingProgress(id, {
    enabled: Boolean(id && appStatus === 'approved'),
  });
  const progress = progressData ?? null;

  const specialtyLabel = getOpportunitySpecialtyLabel(opp, i18n.language, t('form.specialtyUnspecified'));
  const modeLabel = TRAINING_MODES.find((m) => m.value === opp?.training_mode)?.labelKey;
  const heroSubtitle =
    String(opp?.short_description ?? '').trim() ||
    String(opp?.description ?? '').trim().slice(0, 160) ||
    t('student.scopeInfo');

  useEffect(() => {
    if (searchParams.get('apply') !== '1' || !opp) return;
    if (!appStatus || appStatus === 'cancelled') {
      setModalOpen(true);
    }
  }, [searchParams, opp, appStatus]);

  async function handleApply(e) {
    e.preventDefault();
    setFormError('');
    try {
      await applyMut.mutateAsync({ id, body: { student_message: message.trim() || null } });
      setModalOpen(false);
      setMessage('');
      refetch();
    } catch (err) {
      setFormError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  async function handleCancel() {
    if (!appId) return;
    await cancelMut.mutateAsync(appId);
    refetch();
  }

  const tabContent = useMemo(() => {
    if (!isApproved && expelled) return null;
    switch (activeTab) {
      case 'sessions':
        return (
          <StudentSessionsTab opportunityId={id} enabled={canTrainingContent} />
        );
      case 'attendance':
        return (
          <StudentAttendanceTab
            opportunityId={id}
            progress={progress}
            opp={opp}
            enabled={canTrainingContent}
          />
        );
      case 'tasks':
        return (
          <StudentTasksTab
            opportunityId={id}
            enabled={canTrainingContent}
            expelled={expelled}
          />
        );
      case 'assessments':
        return (
          <StudentAssessmentsTab
            opportunityId={id}
            enabled={appStatus === 'approved' && !expelled}
            opp={opp}
          />
        );
      case 'completion':
        return (
          <StudentCompletionTab
            applicationId={appId}
            progress={progress}
            application={application}
            enabled={appStatus === 'approved' && !expelled}
          />
        );
      case 'overview':
      default:
        return (
          <StudentOverviewTab
            progress={progress}
            application={application}
            opp={opp}
            expelled={expelled}
            rejected={appStatus === 'rejected'}
          />
        );
    }
  }, [
    activeTab,
    id,
    isApproved,
    expelled,
    canTrainingContent,
    progress,
    opp,
    appId,
    application,
    appStatus,
  ]);

  if (isLoading) {
    return (
      <PagePermissionGate permission={UI_PERMISSION.canViewFieldTraining}>
        <div className="page page--dashboard page--student ft-page">
          <DetailPageSkeleton />
        </div>
      </PagePermissionGate>
    );
  }

  if (isError || !opp) {
    return (
      <PagePermissionGate permission={UI_PERMISSION.canViewFieldTraining}>
        <div className="page page--dashboard page--student ft-page">
          <div className="ft-student-detail">
            <Link className="ft-student-detail__back" to="/student/field-training">
              <ArrowLeft size={16} aria-hidden />
              <span>{t('student.backToList')}</span>
            </Link>
            <div className="ft-detail-error" role="alert">
              <div className="ft-detail-error__icon-wrap" aria-hidden>
                <Briefcase size={28} />
              </div>
              <h2 className="ft-detail-error__title">{t('student.notFound')}</h2>
              <p className="ft-detail-error__text">{t('student.emptyPublishedDesc')}</p>
              <Link className="btn btn--primary" to="/student/field-training">
                {t('student.backToList')}
              </Link>
            </div>
          </div>
        </div>
      </PagePermissionGate>
    );
  }

  return (
    <PagePermissionGate permission={UI_PERMISSION.canViewFieldTraining}>
      <div className="page page--dashboard page--student ft-page">
        <div className="ft-student-detail">
          <Link className="ft-student-detail__back" to="/student/field-training">
            <ArrowLeft size={16} aria-hidden />
            <span>{t('student.backToList')}</span>
          </Link>

          {expelled ? (
            <StudentExpelledBanner reason={application?.expulsion_reason} />
          ) : null}

          <section className="ft-student-hero" aria-labelledby="ft-opp-title">
            <div className="ft-student-hero__pattern" aria-hidden />
            <div className="ft-student-hero__accent" aria-hidden />
            <div className="ft-student-hero__inner">
              <div className="ft-student-hero__icon-wrap" aria-hidden>
                <Briefcase size={26} />
              </div>
              <div className="ft-student-hero__content">
                <div className="ft-student-hero__meta">
                  <span className="ft-student-hero__specialty">
                    <GraduationCap size={15} aria-hidden />
                    {specialtyLabel}
                  </span>
                  {appStatus ? (
                    <StatusBadge variant={applicationBadgeVariant(expelled ? 'rejected' : appStatus)}>
                      {expelled
                        ? t('trainingStatus.expelled')
                        : t(`applicationStatus.${appStatus}`)}
                    </StatusBadge>
                  ) : (
                    <StatusBadge variant="muted">{t('student.statusNotApplied')}</StatusBadge>
                  )}
                  {isApprovedParticipant && trainingStatus !== 'none' ? (
                    <StatusBadge variant={trainingStatusVariant(trainingStatus)}>
                      {t(`trainingStatus.${trainingStatus}`, trainingStatus)}
                    </StatusBadge>
                  ) : null}
                </div>
                <h1 id="ft-opp-title" className="ft-student-hero__title">
                  {opp.title}
                </h1>
                <p className="ft-student-hero__subtitle">{heroSubtitle}</p>
                <div className="ft-student-hero__actions">
                  {canApply ? (
                    <Button type="button" variant="primary" onClick={() => setModalOpen(true)}>
                      {t('student.applyNow')}
                    </Button>
                  ) : null}
                  {canCancel ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="ft-btn-cancel"
                      onClick={handleCancel}
                      disabled={cancelMut.isPending}
                    >
                      {t('student.cancelApplication')}
                    </Button>
                  ) : null}
                  {isApprovedParticipant ? (
                    <Button type="button" variant="primary" onClick={() => setActiveTab('overview')}>
                      {expelled ? t('studentTraining.viewHistory') : t('student.continueTraining')}
                    </Button>
                  ) : null}
                  {appStatus === 'pending' ? (
                    <span className="ft-student-hero__notice">{t('student.statusSummary.pending.title')}</span>
                  ) : null}
                  {appStatus === 'rejected' ? (
                    <span className="ft-student-hero__notice">{t('student.applicationRejected')}</span>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <div className="ft-info-grid" role="list">
            <DetailInfoCard icon={GraduationCap} label={t('form.specialty')} value={specialtyLabel} />
            <DetailInfoCard
              icon={Briefcase}
              label={t('form.mode')}
              value={modeLabel ? t(modeLabel) : opp.training_mode}
            />
            <DetailInfoCard icon={MapPin} label={t('form.location')} value={opp.location} />
            <DetailInfoCard icon={Calendar} label={t('student.startDate')} value={formatFtDate(opp.start_date)} />
            <DetailInfoCard icon={Calendar} label={t('student.endDate')} value={formatFtDate(opp.end_date)} />
            <DetailInfoCard
              icon={Clock}
              label={t('student.deadline')}
              value={formatFtDate(opp.application_deadline) ?? t('student.dateNotSet')}
            />
            <DetailInfoCard
              icon={Users}
              label={t('student.seats')}
              value={opp.seats_limit != null ? String(opp.seats_limit) : t('student.dateNotSet')}
            />
          </div>

          {isApprovedParticipant ? (
            <section className="ft-student-hub" aria-label={t('studentTraining.hubLabel')}>
              <StudentTrainingTabNav
                activeTab={activeTab}
                onTabChange={setActiveTab}
                disabledTabs={
                  expelled ? ['sessions', 'attendance', 'tasks', 'assessments', 'completion'] : []
                }
              />
              <div className="ft-student-hub__panel">{tabContent}</div>
            </section>
          ) : (
            <div className="ft-student-detail__layout">
              <div className="ft-student-detail__main">
                <ContentSection
                  icon={FileText}
                  title={t('student.sectionDescription')}
                  emptyFallback={t('student.noContentFallback')}
                >
                  {opp.description}
                </ContentSection>
                <ContentSection
                  icon={ListChecks}
                  title={t('form.requirements')}
                  emptyFallback={t('student.noContentFallback')}
                >
                  {opp.requirements}
                </ContentSection>
              </div>
              <div className="ft-student-detail__aside">
                <ApplicationStatusCard
                  statusKey={statusKey}
                  t={t}
                  canApply={canApply}
                  canCancel={canCancel}
                  showTrainingCta={false}
                  application={application}
                  trainingStatus={trainingStatus}
                  onApply={() => setModalOpen(true)}
                  onCancel={handleCancel}
                  cancelPending={cancelMut.isPending}
                />
                <ContentSection
                  icon={Award}
                  title={t('student.sectionBenefits')}
                  emptyFallback={t('student.noContentFallback')}
                >
                  {opp.benefits}
                </ContentSection>
              </div>
            </div>
          )}
        </div>

        {modalOpen ? (
          <div className="ft-modal-backdrop" onClick={() => setModalOpen(false)} role="presentation">
            <div
              className="ft-modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="ft-apply-title"
            >
              <h2 id="ft-apply-title" className="ft-modal__title">
                {t('student.applyTitle')}
              </h2>
              <form onSubmit={handleApply} noValidate>
                {formError ? (
                  <p className="form-field__error" role="alert">
                    {formError}
                  </p>
                ) : null}
                <FormTextarea
                  id="apply-msg"
                  label={t('student.yourMessage')}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                />
                <div className="ft-modal__actions">
                  <Button type="submit" variant="primary" disabled={applyMut.isPending}>
                    {applyMut.isPending ? t('student.submitting') : t('student.submitApplication')}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                    {t('cancel')}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </PagePermissionGate>
  );
}
