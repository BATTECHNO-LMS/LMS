import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../features/auth/index.js';
import { ROLES } from '../../../constants/roles.js';
import { UnauthorizedPage } from '../../../components/permissions/UnauthorizedPage.jsx';
import { AdminCoursesPage } from './AdminCoursesPage.jsx';

export function SuperAdminCoursesRoute({ children }) {
  const { user } = useAuth();
  const { t } = useTranslation('courses');

  if (user?.role !== ROLES.SUPER_ADMIN) {
    return <UnauthorizedPage title={t('unauthorized.title')} description={t('unauthorized.description')} />;
  }

  return children ?? <AdminCoursesPage />;
}
