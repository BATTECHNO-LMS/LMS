import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from '../common/BrandLogo.jsx';
import { PortalCard } from './PortalCard.jsx';
import { PORTAL_ENTRIES } from '../../constants/portalConfig.js';
import { cn } from '../../utils/helpers.js';
import { useAuth } from '../../features/auth/index.js';
import { resolveAuthenticatedPublicPageRedirect } from '../../utils/resolveAuthenticatedLandingRoute.js';

/**
 * Shared portal-selection layout used by `/portals` and the public home section.
 * Static structure renders immediately; auth is only used for an optional dashboard CTA.
 */
export function PortalSelection({
  variant = 'page',
  isArabic = true,
  showLogo = true,
  showHomeLink = true,
  showDashboardCta = true,
  className,
  id = 'portal-entry',
}) {
  const { t } = useTranslation('landing');
  const { isAuthenticated, user } = useAuth();
  const heading = t('entryPortals.title');
  const subtitle = t('entryPortals.subtitle');

  const authRedirect =
    isAuthenticated && user ? resolveAuthenticatedPublicPageRedirect(user) : null;

  return (
    <section
      id={id}
      className={cn('portal-selection', `portal-selection--${variant}`, className)}
      dir={isArabic ? 'rtl' : 'ltr'}
      aria-labelledby={`${id}-heading`}
    >
      <div className="portal-selection__inner">
        {showLogo ? (
          <div className="portal-selection__brand">
            <BrandLogo variant="portal" alt="BATTECHNO LMS" align="center" />
          </div>
        ) : null}

        <header className="portal-selection__header">
          <h2 id={`${id}-heading`} className="portal-selection__title">
            {heading}
          </h2>
          <p className="portal-selection__subtitle">{subtitle}</p>
        </header>

        {showDashboardCta && authRedirect?.path ? (
          <div className="portal-selection__session">
            <Link to={authRedirect.path} className="portal-selection__dashboard-link">
              {t('entryPortals.dashboardCta')}
            </Link>
          </div>
        ) : null}

        <div className="portal-selection__grid">
          <PortalCard portal={PORTAL_ENTRIES.UNIVERSITY} isArabic={isArabic} />
          <PortalCard portal={PORTAL_ENTRIES.INSTITUTION} isArabic={isArabic} />
        </div>

        {showHomeLink ? (
          <p className="portal-selection__footer">
            <Link to="/">{t('entryPortals.homeLink')}</Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}

export { PortalCard } from './PortalCard.jsx';
