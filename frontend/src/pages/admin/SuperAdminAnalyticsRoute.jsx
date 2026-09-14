import { useTranslation } from 'react-i18next';
import { useAuth } from '../../features/auth/index.js';
import { ROLES } from '../../constants/roles.js';
import { UnauthorizedPage } from '../../components/permissions/UnauthorizedPage.jsx';
import { AnalyticsCommandCenterPage } from './analytics/AnalyticsCommandCenterPage.jsx';

/** Command Center for super_admin and organization admin. */
export function SuperAdminAnalyticsRoute() {
  const { user } = useAuth();
  const { t } = useTranslation('analytics');
  const allowed = user?.role === ROLES.SUPER_ADMIN || user?.role === ROLES.ADMIN || user?.isGlobal;

  if (!allowed) {
    return <UnauthorizedPage title={t('unauthorized.title')} description={t('unauthorized.description')} />;
  }

  return <AnalyticsCommandCenterPage />;
}
