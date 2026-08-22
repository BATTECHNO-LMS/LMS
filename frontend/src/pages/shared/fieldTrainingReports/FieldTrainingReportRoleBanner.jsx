import { useTranslation } from 'react-i18next';
import { resolveReportRoleContext } from './reportCapabilities.js';

export function FieldTrainingReportRoleBanner({ user, mode, capabilities }) {
  const { t } = useTranslation('fieldTrainingReports');
  const roleContext = resolveReportRoleContext(user, mode, capabilities);
  return (
    <div className={`ft-report-role-banner ft-report-role-banner--${roleContext}`} role="status">
      <strong>{t(`roleBanner.${roleContext}.title`)}</strong>
      <span>{t(`roleBanner.${roleContext}.subtitle`)}</span>
    </div>
  );
}
