import { useLocale } from '../../features/locale/index.js';
import { PortalSelection } from '../../components/portal/PortalSelection.jsx';
import { useAuth } from '../../features/auth/index.js';
import { Navigate } from 'react-router-dom';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { resolveAuthenticatedPublicPageRedirect } from '../../utils/resolveAuthenticatedLandingRoute.js';

export function PortalPickerPage() {
  const { isArabic } = useLocale();
  const { isAuthenticated, user, isAuthReady } = useAuth();

  if (!isAuthReady) {
    return <LoadingSpinner />;
  }

  // Authenticated visitors resolve to their allowed destination (no loops on login pages).
  if (isAuthenticated && user) {
    const dest = resolveAuthenticatedPublicPageRedirect(user);
    if (
      dest.kind === 'dashboard' ||
      dest.kind === 'select_organization' ||
      dest.kind === 'account_status' ||
      dest.kind === 'verify_email'
    ) {
      return <Navigate to={dest.path} replace />;
    }
  }

  return (
    <PortalSelection
      variant="page"
      isArabic={isArabic}
      showLogo
      showHomeLink
      showDashboardCta={Boolean(isAuthenticated && user)}
    />
  );
}
