import { AlertTriangle, ShieldAlert, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/helpers.js';

const ICONS = {
  warning: AlertTriangle,
  danger: ShieldAlert,
  info: Info,
};

export function AnalyticsAlertCard({ severity = 'warning', messageKey, params, className }) {
  const { t } = useTranslation('analytics');
  const Icon = ICONS[severity] ?? AlertTriangle;

  return (
    <div className={cn('analytics-alert-card', `analytics-alert-card--${severity}`, className)} role="status">
      <span className="analytics-alert-card__icon" aria-hidden>
        <Icon size={20} />
      </span>
      <p className="analytics-alert-card__text">{t(`alerts.${messageKey}`, { ...(params ?? {}) })}</p>
    </div>
  );
}
