import { useTranslation } from 'react-i18next';
import { useAuth } from '../../features/auth/index.js';
import { useTenant } from '../../features/tenant/index.js';
import { cn } from '../../utils/helpers.js';

/** Shows locked tenant for non-global users (frontend simulation only). */
export function TenantReadonlyBadge({ className }) {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const { isGlobalTenantAccess, currentTenantLabel } = useTenant();

  if (isGlobalTenantAccess && user?.isGlobal) return null;
  if (!currentTenantLabel) return null;

  return (
    <div className={cn('tenant-badge', className)} title={t('tenant.current')}>
      <span className="tenant-badge__label">{t('tenant.current')}</span>
      <span className="tenant-badge__value">{currentTenantLabel}</span>
    </div>
  );
}
