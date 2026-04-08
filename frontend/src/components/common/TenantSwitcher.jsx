import { useTranslation } from 'react-i18next';
import { useAuth } from '../../features/auth/index.js';
import { useTenant } from '../../features/tenant/index.js';
import { TENANT_SCOPE_ALL, getTenantName } from '../../constants/tenants.js';
import { cn } from '../../utils/helpers.js';

/**
 * Frontend-only tenant scope control for global (e.g. super_admin) users.
 */
export function TenantSwitcher({ className }) {
  const { t, i18n } = useTranslation('common');
  const { user } = useAuth();
  const { scopeId, setScopeId, availableTenants, isGlobalTenantAccess } = useTenant();

  if (!isGlobalTenantAccess || !user?.isGlobal) return null;

  return (
    <div className={cn('tenant-scope', className)}>
      <span className="tenant-scope__label">{t('tenant.scope')}</span>
      <select
        className="tenant-scope__select"
        value={scopeId}
        aria-label={t('tenant.select')}
        onChange={(e) => setScopeId(e.target.value)}
      >
        <option value={TENANT_SCOPE_ALL}>{t('tenant.allUniversities')}</option>
        {availableTenants.map((tenant) => (
          <option key={tenant.id} value={tenant.id}>
            {tenant.code} — {getTenantName(tenant, i18n.language)}
          </option>
        ))}
      </select>
    </div>
  );
}
