import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  Lock,
  MapPin,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { Button } from '../../components/common/Button.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import { FormTextarea } from '../../components/forms/FormTextarea.jsx';
import {
  TRAINING_MODES,
  useApplyFieldTraining,
  useCancelFieldTrainingApplication,
  useStudentFieldTraining,
  applicationBadgeVariant,
  formatFtDate,
} from '../../features/fieldTraining/index.js';
import { PagePermissionGate } from '../../components/permissions/PagePermissionGate.jsx';
import { UI_PERMISSION } from '../../constants/permissions.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';
import { StudentFieldTrainingTasksPanel } from '../admin/fieldTraining/components/StudentFieldTrainingTasksPanel.jsx';

const TIMELINE_STEPS = ['view', 'apply', 'review', 'accepted', 'tasks'];

function getTimelineState(appStatus) {
  if (!appStatus || appStatus === 'cancelled') {
    return { activeIndex: 0, rejected: false };
  }
  if (appStatus === 'pending') {
    return { activeIndex: 2, rejected: false };
  }
  if (appStatus === 'rejected') {
    return { activeIndex: 2, rejected: true };
  }
  if (appStatus === 'approved') {
    return { activeIndex: 4, rejected: false };
  }
  return { activeIndex: 0, rejected: false };
}

function FactItem({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="ft-fact">
      <Icon size={18} className="ft-fact__icon" aria-hidden />
      <div>
        <span className="ft-fact__label">{label}</span>
        <span className="ft-fact__value">{value}</span>
      </div>
    </div>
  );
}

export function StudentFieldTrainingDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation('fieldTraining');
  const { t: tCommon } = useTranslation('common');
  const { data, isLoading, isError, refetch } = useStudentFieldTraining(id);
  const applyMut = useApplyFieldTraining();
  const cancelMut = useCancelFieldTrainingApplication();
  const [modalOpen, setModalOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');

  const opp = data?.opportunity;
  const appStatus = opp?.my_application_status;
  const appId = opp?.my_application_id;
  const canApply = !appStatus || appStatus === 'cancelled';
  const canCancel = appStatus === 'pending' && appId;
  const isApproved = appStatus === 'approved';

  const timeline = useMemo(() => getTimelineState(appStatus), [appStatus]);

  useEffect(() => {
    if (searchParams.get('apply') !== '1' || !opp) return;
    if (!appStatus || appStatus === 'cancelled') {
      setModalOpen(true);
    }
  }, [searchParams, opp, appStatus]);

  const modeLabel = TRAINING_MODES.find((m) => m.value === opp?.training_mode)?.labelKey;

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

  if (isLoading) return <LoadingSpinner />;

  if (isError || !opp) {
    return (
      <PagePermissionGate permission={UI_PERMISSION.canViewFieldTraining}>
        <div className="page page--dashboard page--student ft-page">
          <Link className="btn btn--ghost btn--sm ft-detail-back" to="/student/field-training">
            <ArrowLeft size={16} /> {t('student.backToList')}
          </Link>
          <div className="ft-empty">
            <p role="alert">{t('student.notFound')}</p>
          </div>
        </div>
      </PagePermissionGate>
    );
  }

  return (
    <PagePermissionGate permission={UI_PERMISSION.canViewFieldTraining}>
      <div className="page page--dashboard page--student ft-page">
        <Link className="btn btn--ghost btn--sm ft-detail-back" to="/student/field-training">
          <ArrowLeft size={16} /> {t('student.backToList')}
        </Link>

        <section className="ft-detail-hero">
          <div className="ft-detail-hero__top">
            <div>
              <h1 className="ft-detail-hero__title">{opp.title}</h1>
              <p className="ft-detail-hero__org">{opp.organization_name}</p>
              {appStatus ? (
                <p style={{ marginTop: '0.5rem' }}>
                  <StatusBadge variant={applicationBadgeVariant(appStatus)}>
                    {t(`applicationStatus.${appStatus}`)}
                  </StatusBadge>
                </p>
              ) : null}
            </div>
            <div className="ft-detail-hero__actions">
              {canApply ? (
                <Button type="button" variant="primary" onClick={() => setModalOpen(true)}>
                  {t('student.applyNow')}
                </Button>
              ) : null}
              {canCancel ? (
                <Button type="button" variant="outline" onClick={handleCancel} disabled={cancelMut.isPending}>
                  {t('student.cancelApplication')}
                </Button>
              ) : null}
              {isApproved ? (
                <a href="#ft-tasks" className="btn btn--primary btn--sm">
                  {t('student.goToTasks')}
                </a>
              ) : null}
            </div>
          </div>

          <div className="ft-facts-grid">
            <FactItem icon={Building2} label={t('form.organization')} value={opp.organization_name} />
            <FactItem icon={MapPin} label={t('form.location')} value={opp.location} />
            <FactItem
              icon={Briefcase}
              label={t('form.mode')}
              value={modeLabel ? t(modeLabel) : opp.training_mode}
            />
            <FactItem icon={Calendar} label={t('student.startDate')} value={formatFtDate(opp.start_date)} />
            <FactItem icon={Calendar} label={t('student.endDate')} value={formatFtDate(opp.end_date)} />
            <FactItem
              icon={Clock}
              label={t('student.deadline')}
              value={formatFtDate(opp.application_deadline) ?? t('student.dateNotSet')}
            />
            <FactItem
              icon={Users}
              label={t('student.seats')}
              value={opp.seats_limit != null ? String(opp.seats_limit) : null}
            />
          </div>
        </section>

        <section className="ft-timeline" aria-labelledby="ft-timeline-title">
          <h2 id="ft-timeline-title" className="ft-timeline__title">
            {t('student.journeyTitle')}
          </h2>
          <ol className="ft-timeline__steps">
            {TIMELINE_STEPS.map((step, index) => {
              let stepClass = 'ft-timeline__step';
              if (index < timeline.activeIndex) stepClass += ' ft-timeline__step--done';
              if (index === timeline.activeIndex && !timeline.rejected) stepClass += ' ft-timeline__step--active';
              if (timeline.rejected && index === 2) stepClass += ' ft-timeline__step--rejected';
              return (
                <li key={step} className={stepClass}>
                  <span className="ft-timeline__dot">{index + 1}</span>
                  <span className="ft-timeline__label">{t(`student.journey.${step}`)}</span>
                </li>
              );
            })}
          </ol>
          {appStatus === 'rejected' ? (
            <p className="ft-timeline__note" role="status">
              {t('student.applicationRejected')}
            </p>
          ) : null}
        </section>

        {opp.description ? (
          <section className="ft-content-section">
            <h3>{t('student.sectionDescription')}</h3>
            <p>{opp.description}</p>
          </section>
        ) : null}
        {opp.requirements ? (
          <section className="ft-content-section">
            <h3>{t('form.requirements')}</h3>
            <p>{opp.requirements}</p>
          </section>
        ) : null}
        {opp.benefits ? (
          <section className="ft-content-section">
            <h3>{t('student.sectionBenefits')}</h3>
            <p>{opp.benefits}</p>
          </section>
        ) : null}

        <section id="ft-tasks">
          <h2 className="ft-section-title">{t('tasks.studentTitle')}</h2>
          {isApproved ? (
            <StudentFieldTrainingTasksPanel opportunityId={id} />
          ) : (
            <div className="ft-panel-locked">
              <Lock size={40} aria-hidden />
              <h3>{t('student.tasksLockedTitle')}</h3>
              <p>{t('student.tasksLockedDesc')}</p>
            </div>
          )}
        </section>

        {modalOpen ? (
          <div
            className="ft-modal-backdrop"
            onClick={() => setModalOpen(false)}
            role="presentation"
          >
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
