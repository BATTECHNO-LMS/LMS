import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { useAuth } from '../../features/auth/index.js';
import { canAccessPath, getPageTitleForPath } from '../../constants/navigation.js';
import { getDefaultDashboardPath } from '../../utils/authRouting.js';
import { getLoginPathForCurrentPortal } from '../../utils/portal.js';

/**
 * Fallback for module routes until feature pages exist.
 */
export function ModulePlaceholderPage() {
  const { user } = useAuth();
  const { t: tEmpty } = useTranslation('emptyStates');
  const location = useLocation();

  if (!user) {
    return <Navigate to={getLoginPathForCurrentPortal()} replace />;
  }

  if (!canAccessPath(user, location.pathname)) {
    return <Navigate to={getDefaultDashboardPath(user)} replace />;
  }

  const title = getPageTitleForPath(user.role, location.pathname, user);

  return (
    <div className="page page--dashboard">
      <PageHeader title={title} subtitle={tEmpty('modulePlaceholder.subtitle')} />
      <EmptyState
        title={tEmpty('modulePlaceholder.emptyTitle')}
        description={tEmpty('modulePlaceholder.emptyDescription')}
      />
    </div>
  );
}
