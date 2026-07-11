import { AlertCircle, Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../../components/common/Button.jsx';

export function ManageTabSkeleton({ rows = 4 }) {
  return (
    <div className="ft-manage-skeleton" aria-busy="true" aria-live="polite">
      <div className="ft-manage-skeleton__head" />
      <div className="ft-manage-skeleton__grid">
        {Array.from({ length: Math.min(rows, 4) }).map((_, i) => (
          <div key={i} className="ft-manage-skeleton__card" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={`row-${i}`} className="ft-manage-skeleton__row" />
      ))}
    </div>
  );
}

export function ManageTabError({ message, onRetry }) {
  const { t } = useTranslation('fieldTraining');
  return (
    <div className="ft-manage-error" role="alert">
      <div className="ft-manage-error__icon" aria-hidden>
        <AlertCircle size={28} />
      </div>
      <h3 className="ft-manage-error__title">{t('manageHub.loadErrorTitle')}</h3>
      <p className="ft-manage-error__desc">{message || t('loadError')}</p>
      {onRetry ? (
        <Button type="button" variant="primary" onClick={onRetry}>
          {t('retryLoad')}
        </Button>
      ) : null}
    </div>
  );
}

export function ManageTabEmpty({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="ft-manage-empty-state">
      <div className="ft-manage-empty-state__icon" aria-hidden>
        <Icon size={36} />
      </div>
      <h3 className="ft-manage-empty-state__title">{title}</h3>
      {description ? <p className="ft-manage-empty-state__desc">{description}</p> : null}
      {action ? <div className="ft-manage-empty-state__action">{action}</div> : null}
    </div>
  );
}

export function ManageKpiCard({ icon: Icon, label, value, hint, unavailable = false }) {
  const { t } = useTranslation('fieldTraining');
  const displayValue = unavailable || value == null || value === '' ? '—' : value;
  const displayHint =
    unavailable || value == null || value === ''
      ? t('manageHub.kpi.noDataYet')
      : hint;

  return (
    <article className={`ft-manage-kpi${unavailable || value == null ? ' ft-manage-kpi--empty' : ''}`}>
      <div className="ft-manage-kpi__icon" aria-hidden>
        {Icon ? <Icon size={20} /> : null}
      </div>
      <div className="ft-manage-kpi__body">
        <span className="ft-manage-kpi__label">{label}</span>
        <span className="ft-manage-kpi__value">{displayValue}</span>
        <span className="ft-manage-kpi__hint">{displayHint}</span>
      </div>
    </article>
  );
}
