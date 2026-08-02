import { Link } from 'react-router-dom';
import { GraduationCap, Building2 } from 'lucide-react';
import { PORTAL_TYPES } from '../../constants/portalConfig.js';
import { cn } from '../../utils/helpers.js';

const ICONS = {
  [PORTAL_TYPES.UNIVERSITY]: GraduationCap,
  [PORTAL_TYPES.INSTITUTION]: Building2,
};

/**
 * Reusable portal entry card (universities vs institutions).
 */
export function PortalCard({
  portal,
  isArabic = true,
  className,
  showSecondary = true,
}) {
  if (!portal) return null;
  const Icon = ICONS[portal.type] || Building2;
  const title = isArabic ? portal.titleAr : portal.titleEn;
  const description = isArabic ? portal.descriptionAr : portal.descriptionEn;
  const primaryCta = isArabic ? portal.primaryCtaAr : portal.primaryCtaEn;
  const secondaryCta = isArabic ? portal.secondaryCtaAr : portal.secondaryCtaEn;

  return (
    <article className={cn('portal-card', className)} data-portal={portal.type}>
      <div className="portal-card__icon" aria-hidden>
        <Icon size={32} strokeWidth={1.75} />
      </div>
      <h3 className="portal-card__title">{title}</h3>
      <p className="portal-card__desc">{description}</p>
      <div className="portal-card__actions">
        <Link to={portal.loginPath} className="btn btn--primary btn--lg portal-card__btn">
          {primaryCta}
        </Link>
        {showSecondary && portal.showSecondaryRegister && portal.registerPath ? (
          <Link to={portal.registerPath} className="portal-card__secondary-link">
            {secondaryCta}
          </Link>
        ) : null}
      </div>
    </article>
  );
}
