import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../features/auth/index.js';
import { ROLES } from '../../../constants/roles.js';
import { UnauthorizedPage } from '../../../components/permissions/UnauthorizedPage.jsx';
import { AdminFieldTrainingPage } from './AdminFieldTrainingPage.jsx';

const FIELD_TRAINING_ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.UNIVERSITY_ADMIN];

export function SuperAdminFieldTrainingRoute({ children }) {
  const { user } = useAuth();
  const { t } = useTranslation('fieldTraining');

  if (!FIELD_TRAINING_ADMIN_ROLES.includes(user?.role)) {
    return <UnauthorizedPage title={t('unauthorized.title')} description={t('unauthorized.description')} />;
  }

  return children ?? <AdminFieldTrainingPage />;
}
