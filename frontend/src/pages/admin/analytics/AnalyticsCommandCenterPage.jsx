import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Award,
  BarChart3,
  GraduationCap,
  PlayCircle,
  Radio,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../../features/auth/index.js';
import { ROLES } from '../../../constants/roles.js';
import { useCommandCenter } from '../../../features/analytics/useCommandCenter.js';
import { fetchCommandCenterDrilldown } from '../../../features/analytics/commandCenter.service.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { AnalyticsKpiCard } from '../../../components/analytics/AnalyticsKpiCard.jsx';
import {
  ActiveUsersTrendChart,
  RoleDonutChart,
  ScoreBarsChart,
  AttendanceDonutChart,
  OrgBarsChart,
  ActivityHeatmap,
} from '../../../components/analytics/charts/CommandCenterCharts.jsx';

function formatNumber(value, locale) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat(locale.startsWith('en') ? 'en-GB' : 'ar-JO').format(Number(value));
}

function formatPct(value, locale) {
  if (value == null) return '—';
  return `${formatNumber(value, locale)}%`;
}

function secondsAgo(iso) {
  if (!iso) return null;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
}

function SectionError({ title, onRetry }) {
  return (
    <div className="cc-section-error" role="alert">
      <p>{title}</p>
      {onRetry ? (
        <button type="button" className="btn btn--outline" onClick={onRetry}>
          إعادة المحاولة
        </button>
      ) : null}
    </div>
  );
}

function Skeleton({ className }) {
  return <div className={`cc-skeleton ${className || ''}`} aria-hidden />;
}

function initialsFromName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '؟';
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
}

function Funnel({ stages = [], locale }) {
  if (!stages.length) return <p className="cc-empty">لا توجد بيانات كافية للفترة المحددة.</p>;
  const max = Math.max(...stages.map((s) => s.count), 1);
  return (
    <ol className="cc-funnel">
      {stages.map((s, i) => {
        const width = Math.max((s.count / max) * 100, 46);
        return (
          <li key={s.key} className="cc-funnel__row">
            <span className="cc-funnel__label">{s.labelAr}</span>
            <span className={`cc-funnel__seg cc-funnel__seg--${i % 5}`} style={{ width: `${width}%` }}>
              <span className="cc-funnel__count">{formatNumber(s.count, locale)}</span>
            </span>
            <span className="cc-funnel__pct">{formatPct(s.percentOfCohort, locale)}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function AnalyticsCommandCenterPage() {
  const { t, i18n } = useTranslation('analytics');
  const locale = i18n.language || 'ar';
  const { user } = useAuth();
  const navigate = useNavigate();
  const isSuper = user?.role === ROLES.SUPER_ADMIN || user?.isGlobal;
  const {
    filters,
    setFilter,
    clearOrganization,
    data,
    loading,
    isError,
    error,
    refresh,
    filterOptions,
    live,
    liveStatus,
    lastUpdated,
    activeFilterCount,
  } = useCommandCenter();
  const [mobileFilters, setMobileFilters] = useState(false);
  const [drawer, setDrawer] = useState(null);
  const [healthOpen, setHealthOpen] = useState(false);

  const drillQuery = useQuery({
    queryKey: ['analytics', 'drilldown', drawer, filters],
    queryFn: () => fetchCommandCenterDrilldown(filters, drawer),
    enabled: Boolean(drawer?.type),
  });

  const modules = data?.scope?.modules || filterOptions?.modules || {};
  const summary = data?.summary || [];
  const roleData = useMemo(
    () =>
      (data?.users?.roleDistribution || []).map((r) => ({
        ...r,
        label: t(`cc.roles.${r.role}`, r.role),
      })),
    [data?.users?.roleDistribution, t]
  );

  const orgData = useMemo(
    () =>
      (data?.organizations?.items || []).map((o) => ({
        ...o,
        label: locale.startsWith('en') ? o.nameEn : o.nameAr,
      })),
    [data?.organizations?.items, locale]
  );

  const ago = secondsAgo(lastUpdated);
  const activity = live?.liveActivity?.items || data?.liveActivity?.items || [];

  function kpiValue(key) {
    return summary.find((c) => c.key === key);
  }

  function openDrawer(next) {
    setDrawer(next);
  }

  if (loading && !data) {
    return (
      <div className="page page--admin page--analytics page--cc">
        <div className="cc-header cc-header--skel">
          <Skeleton className="cc-skel-title" />
        </div>
        <div className="analytics-kpi-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="cc-skel-card" />
          ))}
        </div>
      </div>
    );
  }

  if (isError && !data) {
    return (
      <div className="page page--admin page--analytics page--cc">
        <SectionError title={getApiErrorMessage(error, t('error.title'))} onRetry={refresh} />
      </div>
    );
  }

  const comparisonHelper = (cmp) => {
    if (!cmp) return t('cc.kpi.helper');
    if (cmp.kind === 'new') return t('cc.kpi.new');
    if (cmp.kind === 'none') return t('cc.kpi.noCompare');
    return t('cc.kpi.vsPrevious');
  };

  return (
    <div className="page page--admin page--analytics page--cc">
      <header className="cc-header">
        <div className="cc-header__brand">
          <span className="cc-header__icon" aria-hidden>
            <BarChart3 size={22} strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="cc-header__title">{t('cc.page.title')}</h1>
            <p className="cc-header__sub">{t('cc.page.subtitle')}</p>
          </div>
        </div>
        <div className="cc-header__status">
          <span className={`cc-live-badge ${liveStatus === 'sse' || liveStatus === 'polling' ? 'is-on' : ''}`}>
            <Radio size={14} aria-hidden /> {t('cc.live')}
          </span>
          <span className="cc-header__ago">
            {ago == null ? t('cc.updating') : t('cc.updatedAgo', { seconds: ago })}
          </span>
        </div>
      </header>

      <div className="cc-filter-bar analytics-filter-bar">
        <button
          type="button"
          className="btn btn--outline cc-filter-toggle"
          onClick={() => setMobileFilters(true)}
        >
          {t('cc.filters.button')}
          {activeFilterCount ? ` (${activeFilterCount})` : ''}
        </button>
        <div className={`cc-filter-fields ${mobileFilters ? 'is-open' : ''}`}>
          <div className="cc-filter-sheet__head">
            <strong>{t('cc.filters.button')}</strong>
            <button type="button" className="cc-icon-btn" onClick={() => setMobileFilters(false)} aria-label={t('cc.close')}>
              <X size={18} />
            </button>
          </div>
          <div className="analytics-filter-bar__field">
            <span className="analytics-filter-bar__label">{t('cc.filters.period')}</span>
            <div className="cc-period-tabs" role="group" aria-label={t('cc.filters.period')}>
              {[
                ['today', t('cc.filters.today')],
                ['7d', t('cc.filters.d7')],
                ['30d', t('cc.filters.d30')],
                ['custom', t('cc.filters.custom')],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`cc-period-tabs__btn${filters.period === value ? ' is-active' : ''}`}
                  aria-pressed={filters.period === value}
                  onClick={() => setFilter('period', value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {isSuper ? (
            <label className="analytics-filter-bar__field">
              <span className="analytics-filter-bar__label">{t('cc.filters.orgType')}</span>
              <select
                className="analytics-filter-bar__select"
                value={filters.organizationType}
                onChange={(e) => setFilter('organizationType', e.target.value)}
              >
                <option value="">{t('cc.filters.all')}</option>
                <option value="UNIVERSITY">{t('cc.filters.universities')}</option>
                <option value="INSTITUTION">{t('cc.filters.institutions')}</option>
              </select>
            </label>
          ) : null}
          {isSuper ? (
            <label className="analytics-filter-bar__field">
              <span className="analytics-filter-bar__label">{t('cc.filters.organization')}</span>
              <select
                className="analytics-filter-bar__select"
                value={filters.organizationId}
                onChange={(e) => setFilter('organizationId', e.target.value)}
              >
                <option value="">{t('cc.filters.all')}</option>
                {(filterOptions?.organizations || []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {locale.startsWith('en') ? o.nameEn : o.nameAr}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {modules.fieldTraining ? (
            <label className="analytics-filter-bar__field">
              <span className="analytics-filter-bar__label">{t('cc.filters.opportunity')}</span>
              <select
                className="analytics-filter-bar__select"
                value={filters.opportunityId}
                onChange={(e) => setFilter('opportunityId', e.target.value)}
              >
                <option value="">{t('cc.filters.all')}</option>
                {(filterOptions?.opportunities || []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="analytics-filter-bar__field">
            <span className="analytics-filter-bar__label">{t('cc.filters.role')}</span>
            <select
              className="analytics-filter-bar__select"
              value={filters.role}
              onChange={(e) => setFilter('role', e.target.value)}
            >
              <option value="">{t('cc.filters.all')}</option>
              {(filterOptions?.roles || ['student', 'instructor', 'admin']).map((r) => (
                <option key={r} value={r}>
                  {t(`cc.roles.${r}`, r)}
                </option>
              ))}
            </select>
          </label>
          {filters.period === 'custom' ? (
            <>
              <label className="analytics-filter-bar__field">
                <span className="analytics-filter-bar__label">{t('cc.filters.from')}</span>
                <input
                  type="date"
                  className="analytics-filter-bar__select"
                  value={filters.dateFrom}
                  onChange={(e) => setFilter('dateFrom', e.target.value)}
                />
              </label>
              <label className="analytics-filter-bar__field">
                <span className="analytics-filter-bar__label">{t('cc.filters.to')}</span>
                <input
                  type="date"
                  className="analytics-filter-bar__select"
                  value={filters.dateTo}
                  onChange={(e) => setFilter('dateTo', e.target.value)}
                />
              </label>
            </>
          ) : null}
          {filters.organizationId ? (
            <button type="button" className="btn btn--outline" onClick={clearOrganization}>
              {t('cc.filters.clearOrg')}
            </button>
          ) : null}
        </div>
      </div>

      <div className="analytics-kpi-grid">
        <AnalyticsKpiCard
          variant="live"
          live
          title={t('cc.kpi.online')}
          value={kpiValue('onlineUsers')?.available ? formatNumber(kpiValue('onlineUsers').value, locale) : t('cc.kpi.unavailable')}
          icon={Radio}
          info={t('cc.kpi.onlineInfo')}
          helperText={t('cc.kpi.onlineHelper')}
        />
        <AnalyticsKpiCard
          variant="highlight"
          title={t('cc.kpi.active')}
          value={formatNumber(kpiValue('activeUsers')?.value, locale)}
          icon={Activity}
          trend={kpiValue('activeUsers')?.comparison?.changePercent}
          trendKind={kpiValue('activeUsers')?.comparison?.kind}
          helperText={comparisonHelper(kpiValue('activeUsers')?.comparison)}
          sparkline={kpiValue('activeUsers')?.sparkline}
          info={t('cc.kpi.activeInfo')}
        />
        <AnalyticsKpiCard
          title={t('cc.kpi.students')}
          value={formatNumber(kpiValue('totalStudents')?.value, locale)}
          icon={Users}
          onClick={() => navigate('/admin/users?role=student')}
        />
        {kpiValue('trainingOpportunities')?.available ? (
          <AnalyticsKpiCard
            title={t('cc.kpi.opportunities')}
            value={formatNumber(kpiValue('trainingOpportunities')?.value, locale)}
            icon={GraduationCap}
            onClick={() => navigate('/admin/field-training')}
          />
        ) : null}
        {kpiValue('recordedLecturesPublished')?.available ? (
          <AnalyticsKpiCard
            title={t('cc.kpi.lectures')}
            value={formatNumber(kpiValue('recordedLecturesPublished')?.value, locale)}
            icon={PlayCircle}
          />
        ) : null}
        <AnalyticsKpiCard
          variant="progress"
          title={t('cc.kpi.certificates')}
          value={formatNumber(kpiValue('certificatesIssued')?.value, locale)}
          icon={Award}
          trend={kpiValue('certificatesIssued')?.comparison?.changePercent}
          trendKind={kpiValue('certificatesIssued')?.comparison?.kind}
          onClick={() => navigate('/admin/certificates')}
        />
      </div>

      <div className="cc-grid cc-grid--3">
        <article className="cc-card cc-card--wide">
          <h2>{t('cc.charts.activeTrend')}</h2>
          {data?.users?.trend?.length ? (
            <ActiveUsersTrendChart
              data={data.users.trend}
              labels={{ active: t('cc.kpi.active'), newer: t('cc.kpi.newUsers') }}
            />
          ) : (
            <p className="cc-empty">{t('cc.empty.trend')}</p>
          )}
        </article>
        <article className="cc-card">
          <h2>{t('cc.charts.roles')}</h2>
          {roleData.length ? (
            <RoleDonutChart
              data={roleData}
              centerLabel={t('cc.kpi.active')}
              onSelect={(role) => {
                if (role) navigate(`/admin/users?role=${encodeURIComponent(role)}`);
              }}
            />
          ) : (
            <p className="cc-empty">{t('cc.empty.generic')}</p>
          )}
        </article>
        <article className="cc-card">
          <div className="cc-card__head">
            <h2>{t('cc.charts.live')}</h2>
            <span className="status-badge status-badge--live">{t('cc.live')}</span>
          </div>
          <ul className="cc-activity">
            {activity.length ? (
              activity.map((item) => (
                <li key={item.id}>
                  <time>
                    {new Date(item.at).toLocaleTimeString(locale.startsWith('en') ? 'en-GB' : 'ar-JO', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                  <span className="cc-activity__avatar" aria-hidden>
                    {initialsFromName(item.userName || t('cc.activity.user'))}
                  </span>
                  {item.href ? (
                    <Link to={item.href}>
                      <strong>{item.userName || t('cc.activity.user')}</strong> {item.action}
                    </Link>
                  ) : (
                    <span>
                      <strong>{item.userName || t('cc.activity.user')}</strong> {item.action}
                    </span>
                  )}
                  <Activity className="cc-activity__module" size={16} strokeWidth={1.75} aria-hidden />
                </li>
              ))
            ) : (
              <li className="cc-empty">{t('cc.empty.activity')}</li>
            )}
          </ul>
        </article>
      </div>

      {modules.fieldTraining && data?.fieldTraining?.available ? (
        <div className="cc-grid cc-grid--3">
          <article className="cc-card">
            <h2>{t('cc.ft.funnel')}</h2>
            <Funnel stages={data.fieldTraining.funnel?.stages} locale={locale} />
            <button type="button" className="btn btn--outline cc-link-btn" onClick={() => openDrawer({ type: 'eligible' })}>
              {t('cc.ft.eligibleDrill')}
            </button>
          </article>
          <article className="cc-card">
            <h2>{t('cc.ft.scores')}</h2>
            <ScoreBarsChart
              data={(data.fieldTraining.scores?.buckets || []).map((b) => ({ ...b, label: b.labelAr }))}
              onSelect={(bucket) => openDrawer({ type: 'score_bucket', bucket })}
            />
          </article>
          <article className="cc-card">
            <h2>{t('cc.ft.attendance')}</h2>
            <p className="cc-metric">{formatPct(data.attendance?.attendanceRate, locale)}</p>
            <AttendanceDonutChart
              present={data.attendance?.present || 0}
              absent={data.attendance?.absent || 0}
              unspecified={data.attendance?.unspecified || 0}
              rate={data.attendance?.attendanceRate}
              labels={{
                present: t('cc.ft.present'),
                absent: t('cc.ft.absent'),
                unspecified: t('cc.ft.unspecified'),
                rate: t('cc.ft.attendance'),
              }}
            />
          </article>
        </div>
      ) : null}

      {modules.fieldTraining && data?.assessments && data.assessments.available !== false ? (
        <div className="cc-grid cc-grid--3">
          <article className="cc-card cc-card--dark">
            <h2>{t('cc.ft.prePost')}</h2>
            <div className="cc-prepost">
              <div>
                <span>{t('cc.ft.preAvg')}</span>
                <strong>{formatPct(data.assessments.pre?.average, locale)}</strong>
              </div>
              <div>
                <span>{t('cc.ft.postAvg')}</span>
                <strong>{formatPct(data.assessments.post?.average, locale)}</strong>
              </div>
              <div>
                <span>{t('cc.ft.improvement')}</span>
                <strong>
                  {data.assessments.improvementPoints == null
                    ? '—'
                    : `${data.assessments.improvementPoints > 0 ? '+' : ''}${data.assessments.improvementPoints}`}
                </strong>
              </div>
            </div>
          </article>
          {data.recordedLectures?.available ? (
            <article className="cc-card">
              <h2>{t('cc.lectures.title')}</h2>
              <ul className="cc-stat-list">
                <li>
                  {t('cc.lectures.published')} <strong>{formatNumber(data.recordedLectures.publishedLectures, locale)}</strong>
                </li>
                <li>
                  {t('cc.lectures.started')} <strong>{formatNumber(data.recordedLectures.studentsStarted, locale)}</strong>
                </li>
                <li>
                  {t('cc.lectures.completed')} <strong>{formatNumber(data.recordedLectures.completed, locale)}</strong>
                </li>
                <li>
                  {t('cc.lectures.rate')} <strong>{formatPct(data.recordedLectures.completionRate, locale)}</strong>
                </li>
                <li>
                  {t('cc.lectures.uniqueHours')} <strong>{formatNumber(data.recordedLectures.uniqueWatchHours, locale)}</strong>
                </li>
                <li>
                  {t('cc.lectures.watching')} <strong>{formatNumber(data.recordedLectures.currentlyWatching, locale)}</strong>
                </li>
              </ul>
              <ol className="cc-top-list">
                {(data.recordedLectures.topLectures || []).map((lec) => (
                  <li key={lec.id}>
                    <span>{lec.title}</span>
                    <span>
                      {formatNumber(lec.started, locale)} · {formatPct(lec.completionRate, locale)}
                    </span>
                  </li>
                ))}
              </ol>
            </article>
          ) : null}
          <article className="cc-card">
            <h2>{t('cc.heatmap.title')}</h2>
            <ActivityHeatmap
              cells={data.heatmap?.cells || []}
              labels={{
                title: t('cc.heatmap.title'),
                low: t('cc.heatmap.low'),
                high: t('cc.heatmap.high'),
              }}
            />
          </article>
        </div>
      ) : (
        <article className="cc-card">
          <h2>{t('cc.heatmap.title')}</h2>
          <ActivityHeatmap cells={data?.heatmap?.cells || []} labels={{ low: t('cc.heatmap.low'), high: t('cc.heatmap.high') }} />
        </article>
      )}

      {isSuper ? (
        <article className="cc-card">
          <div className="cc-card__head">
            <h2>{t('cc.orgs.title')}</h2>
            <select
              className="analytics-filter-bar__select"
              value={filters.orgMetric}
              onChange={(e) => setFilter('orgMetric', e.target.value)}
            >
              <option value="activeUsers">{t('cc.orgs.activeUsers')}</option>
              <option value="students">{t('cc.orgs.students')}</option>
              <option value="trainingCompletion">{t('cc.orgs.training')}</option>
              <option value="certificates">{t('cc.orgs.certificates')}</option>
            </select>
          </div>
          <p className="cc-card__hint">{data?.organizations?.labelAr}</p>
          {orgData.length ? (
            <OrgBarsChart data={orgData} onSelect={(id) => setFilter('organizationId', id)} />
          ) : (
            <p className="cc-empty">{t('cc.empty.generic')}</p>
          )}
        </article>
      ) : null}

      <div className="cc-grid cc-grid--2">
        <article className="cc-card">
          <h2>{t('cc.courses.title')}</h2>
          {data?.courses?.contentCourses ? (
            <ul className="cc-stat-list">
              <li>
                {t('cc.courses.published')} <strong>{formatNumber(data.courses.contentCourses.publishedCourses, locale)}</strong>
              </li>
              <li>
                {t('cc.courses.enrollments')} <strong>{formatNumber(data.courses.contentCourses.enrollments, locale)}</strong>
              </li>
              <li>
                {t('cc.courses.completed')} <strong>{formatNumber(data.courses.contentCourses.completed, locale)}</strong>
              </li>
              <li>
                {t('cc.courses.rate')} <strong>{formatPct(data.courses.contentCourses.completionRate, locale)}</strong>
              </li>
            </ul>
          ) : (
            <p className="cc-empty">{t('cc.empty.generic')}</p>
          )}
          {data?.courses?.trainingPrograms ? (
            <ul className="cc-stat-list">
              <li>
                {t('cc.courses.programs')} <strong>{formatNumber(data.courses.trainingPrograms.publishedPrograms, locale)}</strong>
              </li>
              <li>
                {t('cc.courses.programEnroll')} <strong>{formatNumber(data.courses.trainingPrograms.enrollments, locale)}</strong>
              </li>
            </ul>
          ) : null}
        </article>
        <article className="cc-card">
          <h2>{t('cc.mc.title')}</h2>
          {data?.microCredentials?.available === false ? (
            <p className="cc-empty">{t('cc.mc.hidden')}</p>
          ) : (
            <ul className="cc-stat-list">
              <li>
                {t('cc.mc.published')} <strong>{formatNumber(data?.microCredentials?.publishedCredentials, locale)}</strong>
              </li>
              <li>
                {t('cc.mc.enrollments')} <strong>{formatNumber(data?.microCredentials?.enrollments, locale)}</strong>
              </li>
              <li>
                {t('cc.mc.completed')} <strong>{formatNumber(data?.microCredentials?.completed, locale)}</strong>
              </li>
              <li>
                {t('cc.mc.certs')} <strong>{formatNumber(data?.microCredentials?.certificatesIssuedInPeriod, locale)}</strong>
              </li>
            </ul>
          )}
          <p className="cc-card__hint">
            {t('cc.certs.letters')}: {formatNumber(data?.certificates?.completionLetters, locale)}
          </p>
        </article>
      </div>

      {isSuper && data?.systemHealth?.available ? (
        <article className="cc-card cc-health">
          <button type="button" className="cc-health__toggle" onClick={() => setHealthOpen((v) => !v)}>
            {t('cc.health.title')}
          </button>
          {healthOpen ? (
            <ul className="cc-stat-list">
              <li>
                {t('cc.health.api')} <strong>{data.systemHealth.apiStatus}</strong>
              </li>
              <li>
                {t('cc.health.db')}{' '}
                <strong>{data.systemHealth.databaseConnectivity ? t('cc.health.ok') : t('cc.health.down')}</strong>
              </li>
              {data.systemHealth.completionLetterJobFailures != null ? (
                <li>
                  {t('cc.health.jobs')} <strong>{formatNumber(data.systemHealth.completionLetterJobFailures, locale)}</strong>
                </li>
              ) : null}
            </ul>
          ) : null}
        </article>
      ) : null}

      {drawer ? (
        <div className="cc-drawer" role="dialog" aria-modal="true">
          <div className="cc-drawer__panel">
            <header>
              <h2>{t('cc.drawer.title')}</h2>
              <button type="button" className="cc-icon-btn" onClick={() => setDrawer(null)} aria-label={t('cc.close')}>
                <X size={18} />
              </button>
            </header>
            {drillQuery.isLoading ? (
              <Skeleton className="cc-skel-card" />
            ) : drillQuery.isError ? (
              <SectionError title={t('cc.drawer.error')} onRetry={() => drillQuery.refetch()} />
            ) : (
              <ul className="cc-drawer__list">
                {(drillQuery.data?.items || []).map((row) => (
                  <li key={row.id}>
                    <span>{row.name}</span>
                    {row.score != null ? <span>{formatNumber(row.score, locale)}</span> : null}
                  </li>
                ))}
                {!drillQuery.data?.items?.length ? <li className="cc-empty">{t('cc.empty.generic')}</li> : null}
              </ul>
            )}
          </div>
          <button type="button" className="cc-drawer__backdrop" aria-label={t('cc.close')} onClick={() => setDrawer(null)} />
        </div>
      ) : null}
    </div>
  );
}
