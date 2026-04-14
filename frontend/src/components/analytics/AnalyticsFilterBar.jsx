import { useTranslation } from 'react-i18next';
import { RefreshCw, FileDown, FileSpreadsheet } from 'lucide-react';
import { cn } from '../../utils/helpers.js';

export function AnalyticsFilterBar({
  filters,
  onFilterChange,
  onTimePreset,
  onRefresh,
  onExportPdf,
  onExportExcel,
  universities = [],
  tracks = [],
  microCredentials = [],
  cohorts = [],
  className,
}) {
  const { t } = useTranslation('analytics');

  return (
    <div className={cn('analytics-filter-bar', className)}>
      <div className="analytics-filter-bar__row">
        <label className="analytics-filter-bar__field">
          <span className="analytics-filter-bar__label">{t('filters.university')}</span>
          <select
            className="analytics-filter-bar__select"
            value={filters.universityId}
            onChange={(e) => onFilterChange('universityId', e.target.value)}
            aria-label={t('filters.university')}
          >
            <option value="">{t('filters.all')}</option>
            {universities.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="analytics-filter-bar__field">
          <span className="analytics-filter-bar__label">{t('filters.track')}</span>
          <select
            className="analytics-filter-bar__select"
            value={filters.trackId}
            onChange={(e) => onFilterChange('trackId', e.target.value)}
            aria-label={t('filters.track')}
          >
            <option value="">{t('filters.all')}</option>
            {tracks.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="analytics-filter-bar__field">
          <span className="analytics-filter-bar__label">{t('filters.microCredential')}</span>
          <select
            className="analytics-filter-bar__select"
            value={filters.microCredentialId}
            onChange={(e) => onFilterChange('microCredentialId', e.target.value)}
            aria-label={t('filters.microCredential')}
          >
            <option value="">{t('filters.all')}</option>
            {microCredentials.map((mc) => (
              <option key={mc.id} value={mc.id}>
                {mc.title}
              </option>
            ))}
          </select>
        </label>
        <label className="analytics-filter-bar__field">
          <span className="analytics-filter-bar__label">{t('filters.cohort')}</span>
          <select
            className="analytics-filter-bar__select"
            value={filters.cohortId}
            onChange={(e) => onFilterChange('cohortId', e.target.value)}
            aria-label={t('filters.cohort')}
          >
            <option value="">{t('filters.all')}</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <label className="analytics-filter-bar__field">
          <span className="analytics-filter-bar__label">{t('filters.from')}</span>
          <input
            className="analytics-filter-bar__select"
            type="date"
            value={filters.from || ''}
            onChange={(e) => onFilterChange('from', e.target.value)}
            aria-label={t('filters.from')}
          />
        </label>
        <label className="analytics-filter-bar__field">
          <span className="analytics-filter-bar__label">{t('filters.to')}</span>
          <input
            className="analytics-filter-bar__select"
            type="date"
            value={filters.to || ''}
            onChange={(e) => onFilterChange('to', e.target.value)}
            aria-label={t('filters.to')}
          />
        </label>
      </div>
      <div className="analytics-filter-bar__row analytics-filter-bar__row--actions">
        <div className="analytics-filter-bar__presets" role="group" aria-label={t('filters.timeRange')}>
          {['last7', 'last30', 'thisTerm', 'thisYear', 'all'].map((key) => (
            <button
              key={key}
              type="button"
              className={cn('analytics-filter-bar__chip', filters.timePreset === key && 'is-active')}
              onClick={() => onTimePreset(key)}
            >
              {t(`filters.presets.${key}`)}
            </button>
          ))}
        </div>
        <div className="analytics-filter-bar__exports">
          <button type="button" className="btn btn--outline analytics-filter-bar__btn" onClick={onExportPdf}>
            <FileDown size={16} aria-hidden /> {t('export.pdf')}
          </button>
          <button type="button" className="btn btn--outline analytics-filter-bar__btn" onClick={onExportExcel}>
            <FileSpreadsheet size={16} aria-hidden /> {t('export.excel')}
          </button>
          <button type="button" className="btn btn--primary analytics-filter-bar__btn" onClick={onRefresh}>
            <RefreshCw size={16} aria-hidden /> {t('export.refresh')}
          </button>
        </div>
      </div>
    </div>
  );
}
