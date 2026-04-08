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
            <option value="uni-1">YU</option>
            <option value="uni-2">UJ</option>
            <option value="uni-3">PSUT</option>
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
            <option value="t1">DS-101</option>
            <option value="t2">SE-201</option>
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
            <option value="mc1">AI-X1</option>
            <option value="mc2">SEC-10</option>
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
            <option value="c1">c1</option>
            <option value="c2">c2</option>
          </select>
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
