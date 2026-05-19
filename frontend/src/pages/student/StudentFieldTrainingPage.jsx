import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  Building2,
  Calendar,
  Clock,
  MapPin,
  Send,
  Users,
  CheckCircle2,
  Search,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { SelectField } from '../../components/admin/SelectField.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import {
  TRAINING_MODES,
  useStudentFieldTrainingList,
  applicationBadgeVariant,
  canApplyToOpportunity,
  computeStudentListStats,
  filterOpportunitiesByTab,
  formatFtDate,
  truncateText,
} from '../../features/fieldTraining/index.js';
import { PagePermissionGate } from '../../components/permissions/PagePermissionGate.jsx';
import { UI_PERMISSION } from '../../constants/permissions.js';

const TABS = ['all', 'not_applied', 'pending', 'approved', 'rejected'];

function applicationStatusLabel(t, status) {
  if (!status || status === 'cancelled') return t('student.statusNotApplied');
  return t(`applicationStatus.${status}`);
}

export function StudentFieldTrainingPage() {
  const { t } = useTranslation('fieldTraining');
  const { t: tCommon } = useTranslation('common');
  const [q, setQ] = useState('');
  const [trainingMode, setTrainingMode] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const params = useMemo(() => {
    const p = {};
    if (trainingMode) p.training_mode = trainingMode;
    const s = q.trim();
    if (s) p.search = s;
    return p;
  }, [q, trainingMode]);

  const { data, isLoading, isError } = useStudentFieldTrainingList(params);
  const allOpportunities = data?.opportunities ?? [];
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
      return { label: t('student.continueTraining'), variant: 'primary', to: `/student/field-training/${opp.id}` };
    }
    if (st === 'pending') {
      return { label: t('student.trackApplication'), variant: 'primary', to: `/student/field-training/${opp.id}` };
    }
    return { label: t('student.viewOpportunity'), variant: 'outline', to: `/student/field-training/${opp.id}` };
  }

  const hasSearch = Boolean(q.trim()) || Boolean(trainingMode);
  const showEmptyPublished = !isLoading && !isError && !allOpportunities.length;
  const showEmptyFilter = !isLoading && !isError && allOpportunities.length > 0 && !opportunities.length;

  return (
    <PagePermissionGate permission={UI_PERMISSION.canViewFieldTraining}>
      <div className="page page--dashboard page--student ft-page">
        <section className="ft-hero" aria-labelledby="ft-student-hero-title">
          <h1 id="ft-student-hero-title" className="ft-hero__title">
            {t('student.title')}
          </h1>
          <p className="ft-hero__desc">{t('student.heroDescription')}</p>
          <div className="ft-hero__stats">
            <div className="ft-stat-mini">
              <span className="ft-stat-mini__value">{stats.available}</span>
              <span className="ft-stat-mini__label">{t('student.statAvailable')}</span>
            </div>
            <div className="ft-stat-mini">
              <span className="ft-stat-mini__value">{stats.pending}</span>
              <span className="ft-stat-mini__label">{t('student.statPending')}</span>
            </div>
            <div className="ft-stat-mini">
              <span className="ft-stat-mini__value">{stats.approved}</span>
              <span className="ft-stat-mini__label">{t('student.statApproved')}</span>
            </div>
          </div>
        </section>

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
                  </header>

                  <div className="ft-opp-card__body">
                    <h2 className="ft-opp-card__title">{o.title}</h2>
                    <p className="ft-opp-card__org">
                      <Building2 size={16} aria-hidden />
                      {o.organization_name}
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
