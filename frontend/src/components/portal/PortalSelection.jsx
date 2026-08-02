import { Link } from 'react-router-dom';
import { BrandLogo } from '../common/BrandLogo.jsx';
import { PortalCard } from './PortalCard.jsx';
import { PORTAL_ENTRIES } from '../../constants/portalConfig.js';
import { cn } from '../../utils/helpers.js';
import { useAuth } from '../../features/auth/index.js';
import { resolveAuthenticatedPublicPageRedirect } from '../../utils/resolveAuthenticatedLandingRoute.js';

/**
 * Shared portal-selection layout used by `/portals` and the public home section.
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
  const { isAuthenticated, user, isAuthReady } = useAuth();
  const heading = 'اختر بوابة الدخول';
  const subtitle = isArabic
    ? 'منصة BATTECHNO LMS تعمل بمحرك واحد مع بوابتين منفصلتين: الجامعات والمؤسسات.'
    : 'BATTECHNO LMS runs on one engine with two portals: universities and institutions.';

  const authRedirect =
    isAuthReady && isAuthenticated && user
      ? resolveAuthenticatedPublicPageRedirect(user)
      : null;

  return (
    <section
      id={id}
      className={cn('portal-selection', `portal-selection--${variant}`, className)}
      dir="rtl"
      aria-labelledby={`${id}-heading`}
    >
      <div className="portal-selection__inner">
        {showLogo ? (
          <div className="portal-selection__brand">
            <BrandLogo variant="header" alt="BATTECHNO LMS" />
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
              الانتقال إلى لوحة التحكم
            </Link>
          </div>
        ) : null}

        {!isAuthReady ? (
          <p className="portal-selection__status" role="status">
            جاري التحميل...
          </p>
        ) : null}

        <div className="portal-selection__grid">
          <PortalCard portal={PORTAL_ENTRIES.UNIVERSITY} isArabic={isArabic} />
          <PortalCard portal={PORTAL_ENTRIES.INSTITUTION} isArabic={isArabic} />
        </div>

        {showHomeLink ? (
          <p className="portal-selection__footer">
            <Link to="/">العودة إلى الصفحة الرئيسية</Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}

export { PortalCard } from './PortalCard.jsx';
