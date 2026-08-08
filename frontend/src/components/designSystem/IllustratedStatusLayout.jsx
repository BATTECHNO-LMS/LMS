import { AlertCircle, Info } from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo.jsx';
import { StatusDetailList } from './StatusDetailList.jsx';
import { cn } from '../../utils/helpers.js';
import learningBroSvg from '../../assets/images/Learning-bro.svg';
import trustVerificationSvg from '../../assets/landing/illustrations/trust-verification.svg';

const STATUS_LABELS = {
  pending: 'بانتظار التفعيل',
  success: 'تم بنجاح',
  warning: 'تنبيه',
  error: 'خطأ',
  info: 'معلومة',
};

/**
 * @param {{
 *   logo?: boolean,
 *   illustration?: React.ReactNode,
 *   title?: React.ReactNode,
 *   description?: React.ReactNode,
 *   details?: Array<object>,
 *   primaryAction?: React.ReactNode,
 *   secondaryAction?: React.ReactNode,
 *   infoMessage?: React.ReactNode,
 *   statusType?: 'pending' | 'success' | 'warning' | 'error' | 'info',
 *   badgeLabel?: React.ReactNode,
 *   children?: React.ReactNode,
 *   className?: string,
 * }} props
 */
export function IllustratedStatusLayout({
  logo = true,
  illustration,
  title,
  description,
  details = [],
  primaryAction,
  secondaryAction,
  infoMessage,
  statusType = 'pending',
  badgeLabel,
  children,
  className,
}) {
  const defaultIllustrationSrc =
    statusType === 'pending' || statusType === 'info' ? trustVerificationSvg : learningBroSvg;

  const visualIllustration =
    illustration ?? (
      <img
        src={defaultIllustrationSrc}
        alt=""
        className="illustrated-status__illustration"
        decoding="async"
      />
    );

  const infoTone =
    statusType === 'error' ? 'error' : statusType === 'success' ? 'success' : statusType === 'info' ? 'info' : null;

  return (
    <div className={cn('illustrated-status', `illustrated-status--${statusType}`, className)}>
      <aside className="illustrated-status__visual" aria-hidden={false}>
        <span className="illustrated-status__deco illustrated-status__deco--a" aria-hidden />
        <span className="illustrated-status__deco illustrated-status__deco--b" aria-hidden />
        <span className="illustrated-status__deco illustrated-status__deco--c" aria-hidden />
        {logo ? (
          <BrandLogo
            variant="auth"
            alt="BATTECHNO LMS"
            align="center"
            className="illustrated-status__logo"
          />
        ) : null}
        {typeof visualIllustration === 'string' ? (
          <img
            src={visualIllustration}
            alt=""
            className="illustrated-status__illustration"
            decoding="async"
          />
        ) : (
          visualIllustration
        )}
      </aside>

      <section className="illustrated-status__content">
        <span className="illustrated-status__badge">
          {badgeLabel ?? STATUS_LABELS[statusType] ?? STATUS_LABELS.info}
        </span>
        {title ? <h1 className="illustrated-status__title">{title}</h1> : null}
        {description ? <p className="illustrated-status__desc">{description}</p> : null}

        <StatusDetailList details={details} />

        {infoMessage ? (
          <div
            className={cn(
              'illustrated-status__info',
              infoTone && `illustrated-status__info--${infoTone}`
            )}
            role="status"
          >
            {statusType === 'error' ? <AlertCircle size={18} aria-hidden /> : <Info size={18} aria-hidden />}
            <span>{infoMessage}</span>
          </div>
        ) : null}

        {primaryAction || secondaryAction ? (
          <div className="illustrated-status__actions">
            {secondaryAction}
            {primaryAction}
          </div>
        ) : null}

        {children ? <div className="illustrated-status__extra">{children}</div> : null}
      </section>
    </div>
  );
}
