import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';

/**
 * Training hours progress card (RTL-friendly).
 * Caps displayed percentage at 100% while still showing completed/remaining values.
 */
export function TrainingHoursProgressCard({ hours, className = '' }) {
  const { t } = useTranslation('fieldTraining');
  const required = hours?.required_training_hours;
  if (required == null) {
    return (
      <section className={`ft-hours-progress ft-hours-progress--empty ${className}`.trim()}>
        <div className="ft-hours-progress__head">
          <Clock size={18} aria-hidden />
          <h3 className="ft-hours-progress__title">{t('hours.title')}</h3>
        </div>
        <p className="ft-hours-progress__empty">{t('hours.notConfigured')}</p>
      </section>
    );
  }

  const completed = Number(hours?.completed_training_hours ?? 0);
  const remaining = hours?.remaining_training_hours != null ? Number(hours.remaining_training_hours) : Math.max(0, required - completed);
  const pct = Math.min(100, Math.max(0, Number(hours?.hours_completion_percentage ?? 0)));
  const status = hours?.hours_completion_status;
  const statusLabel =
    status === 'not_started'
      ? t('hours.status.notStarted')
      : status === 'in_progress'
        ? t('hours.status.inProgress')
        : status === 'completed'
          ? t('hours.status.completed')
          : '—';

  return (
    <section className={`ft-hours-progress ${className}`.trim()} aria-label={t('hours.title')}>
      <div className="ft-hours-progress__head">
        <Clock size={18} aria-hidden />
        <h3 className="ft-hours-progress__title">{t('hours.title')}</h3>
        <span className={`ft-hours-progress__badge ft-hours-progress__badge--${status || 'none'}`}>
          {statusLabel}
        </span>
      </div>

      <div className="ft-hours-progress__stats">
        <div>
          <span className="ft-hours-progress__label">{t('hours.required')}</span>
          <strong>{required}</strong>
          <span className="ft-hours-progress__unit">{t('hours.unit')}</span>
        </div>
        <div>
          <span className="ft-hours-progress__label">{t('hours.completed')}</span>
          <strong>{completed}</strong>
          <span className="ft-hours-progress__unit">{t('hours.unit')}</span>
        </div>
        <div>
          <span className="ft-hours-progress__label">{t('hours.remaining')}</span>
          <strong>{remaining}</strong>
          <span className="ft-hours-progress__unit">{t('hours.unit')}</span>
        </div>
        <div>
          <span className="ft-hours-progress__label">{t('hours.percentage')}</span>
          <strong>{pct}%</strong>
        </div>
      </div>

      <div
        className="ft-hours-progress__bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={t('hours.percentage')}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
    </section>
  );
}

export default TrainingHoursProgressCard;
