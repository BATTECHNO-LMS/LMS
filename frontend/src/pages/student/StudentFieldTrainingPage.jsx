import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  Calendar,
  Clock,
  GraduationCap,
  MapPin,
  Send,
  Users,
  CheckCircle2,
  Search,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { SelectField } from '../../components/admin/SelectField.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import { StudentPageHeader } from '../../components/student/StudentPageHeader.jsx';
import {
  TRAINING_MODES,
  useStudentFieldTrainingList,
  useMyFieldTrainingApplications,
  useCancelFieldTrainingApplication,
  applicationBadgeVariant,
  canApplyToOpportunity,
  computeStudentListStats,
  filterOpportunitiesByTab,
  formatFtDate,
  truncateText,
  getOpportunitySpecialtyLabel,
  trainingStatusVariant,
  TaskProgressBadge,
} from '../../features/fieldTraining/index.js';
import { PagePermissionGate } from '../../components/permissions/PagePermissionGate.jsx';
import { UI_PERMISSION } from '../../constants/permissions.js';
import { ContextualHelpButton } from '../../components/help/ContextualHelpButton.jsx';

const TABS = ['all', 'not_applied', 'pending', 'approved', 'rejected'];

function applicationStatusLabel(t, status) {
  if (!status || status === 'cancelled') return t('student.statusNotApplied');
  return t(`applicationStatus.${status}`);
}

export function StudentFieldTrainingPage() {
  const { t, i18n } = useTranslation('fieldTraining');
  const { t: tCommon } = useTranslation('common');
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 350);
  const [trainingMode, setTrainingMode] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const params = useMemo(() => {
    const p = {};
    if (trainingMode) p.training_mode = trainingMode;
    const s = debouncedQ.trim();
    if (s) p.search = s;
    return p;
  }, [debouncedQ, trainingMode]);

  const { data, isLoading, isError } = useStudentFieldTrainingList(params);
  const { data: myAppsData, isLoading: myAppsLoading } = useMyFieldTrainingApplications();
  const cancelMut = useCancelFieldTrainingApplication();
  const myApplications = myAppsData?.applications ?? [];
  const allOpportunities = data?.opportunities ?? [];
  const profileIncomplete = Boolean(data?.profile_incomplete);
  const profileMessage = data?.message ?? '';
  const stats = useMemo(() => computeStudentListStats(allOpportunities), [allOpportunities]);
  const opportunities = useMemo(
    () => filterOpportunitiesByTab(allOpportunities, activeTab),
    [allOpportunities, activeTab]
  );

  const modeLabel = (m) => {
    const key = TRAINING_MODES.find((x) => x.value === m)?.labelKey;
    return key ? t(key) : m;
  };

  function primaryCta(opp) {
    const st = opp.my_application_status;
    if (canApplyToOpportunity(opp)) {
      return {
        label: t('student.ctaApplyDetails'),
        variant: 'primary',
        to: `/student/field-training/${opp.id}?apply=1`,
      };
    }
    if (st === 'approved') {
      return {
        label: t('student.continueTraining'),
        variant: 'primary',
        to: `/student/field-training/${opp.id}?tab=overview`,
      };
    }
    if (st === 'pending') {
      return { label: t('student.trackApplication'), variant: 'primary', to: `/student/field-training/${opp.id}` };
    }
    return { label: t('student.viewOpportunity'), variant: 'outline', to: `/student/field-training/${opp.id}` };
  }

  const hasSearch = Boolean(q.trim()) || Boolean(trainingMode);
  const showProfileIncomplete = !isLoading && !isError && profileIncomplete;
  const showEmptyPublished =
    !isLoading && !isError && !profileIncomplete && !allOpportunities.length;
  const showEmptyFilter = !isLoading && !isError && !profileIncomplete && allOpportunities.length > 0 && !opportunities.length;

  return (
    <PagePermissionGate permission={UI_PERMISSION.canViewFieldTraining}>
      <div className="page page--dashboard page--student ft-page" data-tour-id="training-opportunities">
        <div className="ug-page-tools">
          <StudentPageHeader title={t('student.title')} description={t('student.heroDescription')} />
          <ContextualHelpButton contextualKey="opportunities" route="/student/field-training" />
        </div>
        {!profileIncomplete ? (
          <p className="ft-hero__scope-info" role="status">
            {t('student.scopeInfo')}
          </p>
        ) : null}
        <AdminStatsGrid>
          <StatCard label={t('student.statAvailable')} value={String(stats.available)} icon={Briefcase} />
          <StatCard label={t('student.statPending')} value={String(stats.pending)} icon={Clock} />
          <StatCard label={t('student.statApproved')} value={String(stats.approved)} icon={CheckCircle2} />
        </AdminStatsGrid>

        {myApplications.length > 0 ? (
          <section className="ft-my-apps" aria-labelledby="ft-my-apps-title">
            <h2 id="ft-my-apps-title" className="ft-my-apps__title">
              {t('student.myApplicationsTitle')}
            </h2>
            {myAppsLoading ? <LoadingSpinner /> : (
              <div className="ft-my-apps__list">
                {myApplications.map((app) => (
                  <article key={app.id} className="ft-my-apps__item">
                    <div className="ft-my-apps__main">
                      <h3 className="ft-my-apps__opp">{app.opportunity?.title ?? t('notAvailable')}</h3>
                      <p className="ft-my-apps__meta">
                        {getOpportunitySpecialtyLabel(app.opportunity, i18n.language, t('form.specialtyUnspecified'))}
                        {' · '}
                        {formatFtDate(app.created_at) ?? t('notAvailable')}
                      </p>
                      {app.admin_note ? (
                        <p className="ft-my-apps__note">{app.admin_note}</p>
                      ) : null}
                    </div>
                    <div className="ft-my-apps__actions">
                      <StatusBadge variant={applicationBadgeVariant(app.status)}>
                        {t(`applicationStatus.${app.status}`)}
                      </StatusBadge>
                      <Link to={`/student/field-training/${app.opportunity_id}`} className="btn btn--sm btn--outline">
                        {t('student.viewOpportunity')}
                      </Link>
                      {app.status === 'pending' ? (
                        <button
                          type="button"
                          className="btn btn--sm btn--outline"
                          disabled={cancelMut.isPending}
                          onClick={() => cancelMut.mutate(app.id)}
                        >
                          {t('student.cancelApplication')}
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}

        <section className="ft-filters-card" aria-label={t('student.filtersLabel')}>
          <div className="ft-filters-card__grid">
            <SearchInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('student.searchPlaceholder')}
              aria-label={tCommon('actions.search')}
            />
            <SelectField
              id="sft-mode"
              label={t('student.filterMode')}
              value={trainingMode}
              onChange={(e) => setTrainingMode(e.target.value)}
            >
              <option value="">{t('student.allModes')}</option>
              {TRAINING_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {t(m.labelKey)}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="ft-chips" style={{ marginTop: '0.85rem' }} role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                className={`ft-chip${activeTab === tab ? ' ft-chip--active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {t(`student.tabs.${tab}`)}
              </button>
            ))}
          </div>
        </section>

        {isLoading ? <LoadingSpinner /> : null}
        {isError ? (
          <p className="field-training-student-page__alert" role="alert">
            {tCommon('errors.generic')}
          </p>
        ) : null}

        {showProfileIncomplete ? (
          <div className="ft-empty">
            <Briefcase size={48} aria-hidden />
            <h3>{t('student.profileIncompleteTitle')}</h3>
            <p>{profileMessage || t('student.profileIncompleteDesc')}</p>
          </div>
        ) : null}

        {showEmptyPublished ? (
          <div className="ft-empty">
            <Briefcase size={48} aria-hidden />
            <h3>{t('student.emptyPublishedTitle')}</h3>
            <p>{t('student.emptyPublishedDesc')}</p>
          </div>
        ) : null}

        {showEmptyFilter ? (
          <div className="ft-empty">
            <Search size={40} aria-hidden />
            <h3>{t('student.emptySearchTitle')}</h3>
            <p>{t('student.emptySearchDesc')}</p>
          </div>
        ) : null}

        {!isLoading && !isError && opportunities.length > 0 ? (
          <div className="ft-opp-grid">
            {opportunities.map((o) => {
              const cta = primaryCta(o);
              const applyable = canApplyToOpportunity(o);
              const appStatus = o.my_application_status;
              const desc =
                truncateText(o.short_description, 140) ||
                (hasSearch ? '' : t('student.noShortDescription'));

              return (
                <article key={o.id} className="ft-opp-card">
                  <header className="ft-opp-card__head">
                    <div className="ft-opp-card__icon" aria-hidden>
                      <Briefcase size={22} />
                    </div>
                    <StatusBadge
                      variant={applicationBadgeVariant(appStatus || 'not_applied')}
                      className="ft-opp-card__badge"
                    >
                      {applicationStatusLabel(t, appStatus)}
                    </StatusBadge>
                    {appStatus === 'approved' && o.my_training_status && o.my_training_status !== 'none' ? (
                      <StatusBadge variant={trainingStatusVariant(o.my_training_status)}>
                        {t(`trainingStatus.${o.my_training_status}`, o.my_training_status)}
                      </StatusBadge>
                    ) : null}
                    <TaskProgressBadge progress={o.my_task_progress} />
                  </header>

                  <div className="ft-opp-card__body">
                    <h2 className="ft-opp-card__title">{o.title}</h2>
                    <p className="ft-opp-card__org">
                      <GraduationCap size={16} aria-hidden />
                      {o.student_matching_university?.name
                        ? o.student_matching_university.name
                        : o.university?.name || o.organization_name || t('notAvailable')}
                      {' · '}
                      {o.student_matching_university_specialty_label ||
                        getOpportunitySpecialtyLabel(o, i18n.language, t('form.specialtyUnspecified'))}
                    </p>

                    {desc ? (
                      <p
                        className={`ft-opp-card__desc${!o.short_description ? ' ft-opp-card__desc--placeholder' : ''}`}
                      >
                        {desc}
                      </p>
                    ) : null}

                    <ul className="ft-opp-card__meta">
                      <li>
                        <MapPin size={15} aria-hidden />
                        <span>{o.location}</span>
                      </li>
                      <li>
                        <Briefcase size={15} aria-hidden />
                        <span>{modeLabel(o.training_mode)}</span>
                      </li>
                      <li>
                        <Calendar size={15} aria-hidden />
                        <span>
                          {t('student.deadline')}:{' '}
                          {formatFtDate(o.application_deadline) ?? t('student.dateNotSet')}
                        </span>
                      </li>
                      {o.start_date ? (
                        <li>
                          <Clock size={15} aria-hidden />
                          <span>
                            {t('student.startDate')}: {formatFtDate(o.start_date)}
                          </span>
                        </li>
                      ) : null}
                      {o.seats_limit != null ? (
                        <li>
                          <Users size={15} aria-hidden />
                          <span>
                            {t('student.seats')}: {o.seats_limit}
                          </span>
                        </li>
                      ) : null}
                    </ul>

                    <div className="ft-opp-card__actions">
                      <Link
                        to={cta.to}
                        className={`btn btn--${cta.variant === 'primary' ? 'primary' : 'outline'} btn--sm`}
                        style={{ flex: 1, justifyContent: 'center' }}
                      >
                        {applyable ? <Send size={16} aria-hidden /> : null}
                        {cta.label}
                      </Link>
                      {!applyable ? (
                        <Link
                          to={`/student/field-training/${o.id}`}
                          className="btn btn--ghost btn--sm"
                        >
                          {t('student.viewOpportunity')}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>
    </PagePermissionGate>
  );
}
