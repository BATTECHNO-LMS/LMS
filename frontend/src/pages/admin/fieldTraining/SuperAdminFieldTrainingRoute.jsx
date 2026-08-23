import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../features/auth/index.js';
import { UnauthorizedPage } from '../../../components/permissions/UnauthorizedPage.jsx';
import { AdminFieldTrainingPage } from './AdminFieldTrainingPage.jsx';
import {
  FIELD_TRAINING_ADMIN_ROLES,
  userHasFieldTrainingAdminRole,
} from './fieldTrainingAdminAccess.js';

export { FIELD_TRAINING_ADMIN_ROLES, userHasFieldTrainingAdminRole };

export function SuperAdminFieldTrainingRoute({ children }) {
  const { user } = useAuth();
  const { t } = useTranslation('fieldTraining');

  if (!userHasFieldTrainingAdminRole(user)) {
    return (
      <UnauthorizedPage
        title={t('unauthorized.title')}
        description={t('unauthorized.description')}
      />
    );
  }

  const isGlobal = Boolean(user?.isGlobal || user?.role === 'super_admin');
  if (!isGlobal && user?.organizationType === 'INSTITUTION') {
    return (
      <UnauthorizedPage
        title={t('unauthorized.title')}
        description={t('unauthorized.description')}
      />
    );
  }

  return children ?? <AdminFieldTrainingPage />;
}
