import { useTranslation } from 'react-i18next';
import { useAuth } from '../../features/auth/index.js';
import { ROLES } from '../../constants/roles.js';
import { UnauthorizedPage } from '../../components/permissions/UnauthorizedPage.jsx';
import { SuperAdminAnalyticsPage } from './SuperAdminAnalyticsPage.jsx';

/** Renders analytics only for super_admin; others see localized unauthorized message. */
export function SuperAdminAnalyticsRoute() {
  const { user } = useAuth();
  const { t } = useTranslation('analytics');

  if (user?.role !== ROLES.SUPER_ADMIN) {
    return <UnauthorizedPage title={t('unauthorized.title')} description={t('unauthorized.description')} />;
  }

  return <SuperAdminAnalyticsPage />;
}
