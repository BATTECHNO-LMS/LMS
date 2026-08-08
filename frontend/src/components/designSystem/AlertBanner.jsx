import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Info,
  Wrench,
} from 'lucide-react';
import { cn } from '../../utils/helpers.js';

const VARIANT_ICON = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
  important: AlertOctagon,
  urgent: AlertOctagon,
  maintenance: Wrench,
};

/**
 * @param {{
 *   variant?: 'info' | 'success' | 'warning' | 'danger' | 'important' | 'urgent' | 'maintenance',
 *   title?: React.ReactNode,
 *   children?: React.ReactNode,
 *   className?: string,
 *   icon?: boolean | React.ReactNode,
 * }} props
 */
export function AlertBanner({ variant = 'info', title, children, className, icon = true }) {
  const Icon = VARIANT_ICON[variant] || Info;
  const showDefaultIcon = icon === true;
  const customIcon = icon && icon !== true ? icon : null;

  return (
    <div className={cn('ds-alert', `ds-alert--${variant}`, className)} role="status">
      {showDefaultIcon || customIcon ? (
        <span className="ds-alert__icon" aria-hidden>
          {customIcon || <Icon size={18} />}
        </span>
      ) : null}
      <div className="ds-alert__body">
        {title ? <p className="ds-alert__title">{title}</p> : null}
        {children ? <div className="ds-alert__message">{children}</div> : null}
      </div>
    </div>
  );
}
