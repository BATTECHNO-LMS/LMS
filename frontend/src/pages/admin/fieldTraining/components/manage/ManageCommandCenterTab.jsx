import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { LoadingSpinner } from '../../../../../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../../../../../components/common/EmptyState.jsx';
import { getApiErrorMessage } from '../../../../../../services/apiHelpers.js';
import { fetchOpportunityCommandCenter } from '../../../../../../features/fieldTraining/fieldTraining.service.js';
import { fieldTrainingKeys } from '../../../../../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';

const QUICK_FILTERS = [
  'needs_attention',
  'near_completion',
  'not_ready',
  'post_incomplete',
  'tasks_overdue',
  'low_attendance',
  'lectures_incomplete',
  'ready_to_complete',
  'blocked',
];

function riskClass(level) {
  return String(level || 'NONE').toLowerCase();
}

export function ManageCommandCenterTab({ opportunityId, apiScope = 'admin' }) {
  const { t } = useTranslation('fieldTraining');
  const isInstructor = apiScope === 'instructor';
  const listBase = isInstructor ? '/instructor/field-training' : '/admin/field-training';
  const [page, setPage] = useState(1);
  const [quick, setQuick] = useState('needs_attention');
  const [riskLevel, setRiskLevel] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('highest_risk');
  const [selected, setSelected] = useState(null);

  const params = useMemo(
    () => ({
      page,
      page_size: 25,
      quick_filter: quick,
      sort,
      ...(riskLevel ? { risk_level: riskLevel } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
    }),
    [page, quick, riskLevel, search, sort]
  );

  const query = useQuery({
    queryKey: fieldTrainingKeys.commandCenter(opportunityId, apiScope, params),
    queryFn: () =>
      fetchOpportunityCommandCenter(opportunityId, params, { asInstructor: isInstructor }),
    enabled: Boolean(opportunityId),
    staleTime: 45_000,
    refetchInterval: 60_000,
  });

  const data = query.data;
  const summary = data?.summary || {};
  const rows = data?.attention_queue || [];
  const meta = data?.meta || { page: 1, page_size: 25, total: 0, total_pages: 1 };

  if (query.isLoading) return <LoadingSpinner />;
  if (query.isError) {
    return (
      <EmptyState
        title={t('commandCenter.loadError')}
        description={getApiErrorMessage(query.error, t('loadError'))}
      />
    );
  }

  return (
    <div className="ft-command-center">
      <header className="ft-command-center__hero">
        <div>
          <p className="ft-command-center__eyebrow">{t('commandCenter.eyebrow')}</p>
          <h2 className="ft-command-center__title">{t('commandCenter.title')}</h2>
          <p className="ft-command-center__lead">{t('commandCenter.lead')}</p>
        </div>
      </header>

      <div className="ft-command-center__kpis" role="group" aria-label={t('commandCenter.kpisLabel')}>
        {[
          ['needs_attention', summary.needs_attention],
          ['intervention_open', summary.intervention_open],
          ['intervention_overdue_follow_ups', summary.intervention_overdue_follow_ups],
          ['live_attendance_windows', summary.live_attendance_windows],
          ['logbook_pending', summary.logbook_pending],
          ['logbook_revision_requested', summary.logbook_revision_requested],
          ['external_pending_evaluations', summary.external_pending_evaluations],
          ['low_attendance', summary.low_attendance],
          ['tasks_overdue', summary.tasks_overdue],
          ['lectures_incomplete', summary.lectures_incomplete],
          ['post_incomplete', summary.post_incomplete],
          ['near_completion', summary.near_completion],
          ['ready_to_complete', summary.ready_to_complete],
          ['blocked', summary.blocked],
        ].map(([key, value]) => (
          <button
            key={key}
            type="button"
            className={`ft-command-center__kpi${quick === key ? ' is-active' : ''}`}
            onClick={() => {
              setQuick(key);
              setPage(1);
            }}
          >
            <span className="ft-command-center__kpi-value">{value ?? 0}</span>
            <span className="ft-command-center__kpi-label">{t(`commandCenter.kpi.${key}`)}</span>
          </button>
        ))}
      </div>

      <div className="ft-command-center__toolbar">
        <div className="ft-command-center__quick">
          {QUICK_FILTERS.map((key) => (
            <button
              key={key}
              type="button"
              className={`ft-command-center__chip${quick === key ? ' is-active' : ''}`}
              onClick={() => {
                setQuick(key);
                setPage(1);
              }}
            >
              {t(`commandCenter.quick.${key}`)}
            </button>
          ))}
        </div>
        <div className="ft-command-center__controls">
          <label>
            <span className="visually-hidden">{t('commandCenter.search')}</span>
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t('commandCenter.searchPlaceholder')}
            />
          </label>
          <select
            value={riskLevel}
            onChange={(e) => {
              setRiskLevel(e.target.value);
              setPage(1);
            }}
            aria-label={t('commandCenter.riskFilter')}
          >
            <option value="">{t('commandCenter.allRisks')}</option>
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((level) => (
              <option key={level} value={level}>
                {t(`commandCenter.risk.${level}`)}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label={t('commandCenter.sort')}
          >
            {['highest_risk', 'closest_to_completion', 'lowest_score', 'hours_remaining', 'last_activity', 'student_name'].map(
              (key) => (
                <option key={key} value={key}>
                  {t(`commandCenter.sortOptions.${key}`)}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {!rows.length ? (
        <EmptyState
          title={t('commandCenter.emptyTitle')}
          description={t('commandCenter.emptyDesc')}
        />
      ) : (
        <ul className="ft-command-center__queue">
          {rows.map((row) => (
            <li key={row.application_id} className={`ft-command-center__row risk-${riskClass(row.risk?.riskLevel)}`}>
              <div className="ft-command-center__row-main">
                <span className={`ft-command-center__risk ft-command-center__risk--${riskClass(row.risk?.riskLevel)}`}>
                  {row.risk?.risk_level_label_ar || row.risk?.riskLevel}
                </span>
                <div>
                  <strong className="ft-command-center__name">{row.student_name}</strong>
                  <p className="ft-command-center__reason">
                    {t('commandCenter.reasonLabel')}:{' '}
                    {row.risk?.primary_reason_label_ar ||
                      row.readiness?.explanation_ar ||
                      t('commandCenter.noPrimaryReason')}
                  </p>
                  <p className="ft-command-center__meta">
                    {t('commandCenter.readiness')}: {row.readiness?.state_label_ar}
                    {row.score?.final != null ? ` · ${row.score.final}/100` : ''}
                    {row.hours_progress?.required != null
                      ? ` · ${row.hours_progress.completed ?? 0}/${row.hours_progress.required} ${t('commandCenter.hoursUnit')}`
                      : ''}
                  </p>
                </div>
              </div>
              <div className="ft-command-center__row-actions">
                <button type="button" className="btn btn--sm btn--outline" onClick={() => setSelected(row)}>
                  {t('commandCenter.viewStudent')}
                </button>
                {row.intervention?.has_open_case ? (
                  <Link
                    className="btn btn--sm btn--outline"
                    to={`${listBase}/${opportunityId}/manage?tab=interventions`}
                  >
                    {t('commandCenter.openExistingCase')}
                  </Link>
                ) : row.intervention?.suggest_open_case ? (
                  <Link
                    className="btn btn--sm btn--outline"
                    to={`${listBase}/${opportunityId}/manage?tab=interventions`}
                  >
                    {t('commandCenter.openInterventionCase')}
                  </Link>
                ) : null}
                <Link
                  className="btn btn--sm btn--primary"
                  to={`${listBase}/${opportunityId}/students/${row.application_id}/report`}
                >
                  {t('commandCenter.openReport')}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {meta.total_pages > 1 ? (
        <div className="ft-command-center__pager">
          <button
            type="button"
            className="btn btn--sm btn--outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t('commandCenter.prev')}
          </button>
          <span>
            {meta.page} / {meta.total_pages} · {meta.total}
          </span>
          <button
            type="button"
            className="btn btn--sm btn--outline"
            disabled={page >= meta.total_pages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('commandCenter.next')}
          </button>
        </div>
      ) : null}

      {selected ? (
        <div className="ft-command-center__drawer" role="dialog" aria-modal="true">
          <div className="ft-command-center__drawer-panel">
            <header className="ft-command-center__drawer-head">
              <h3>{selected.student_name}</h3>
              <button type="button" className="btn btn--sm btn--outline" onClick={() => setSelected(null)}>
                {t('commandCenter.close')}
              </button>
            </header>
            <p>
              <strong>{t('commandCenter.readiness')}:</strong> {selected.readiness?.state_label_ar}
            </p>
            <p>{selected.readiness?.explanation_ar}</p>
            {selected.risk?.explanations_ar?.length ? (
              <ul>
                {selected.risk.explanations_ar.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
            <p>
              <strong>{t('commandCenter.nextAction')}:</strong>{' '}
              {selected.next_action?.label_ar || '—'}
            </p>
            <div className="ft-command-center__drawer-actions">
              <Link
                className="btn btn--primary"
                to={`${listBase}/${opportunityId}/manage?tab=eligibility`}
                onClick={() => setSelected(null)}
              >
                {t('commandCenter.openEligibility')}
              </Link>
              <Link
                className="btn btn--outline"
                to={`${listBase}/${opportunityId}/students/${selected.application_id}/report`}
              >
                {t('commandCenter.openReport')}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
