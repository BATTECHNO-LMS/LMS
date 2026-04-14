import { pickPrimaryRole } from '../features/auth/authUserMapper.js';
import { getDashboardPathForRole } from './helpers.js';

/**
 * Home route after authentication — uses role priority when multiple roles exist.
 * @param {{ role?: string, roles?: string[] } | null | undefined} user
 */
export function getDefaultDashboardPath(user) {
  if (!user || typeof user !== 'object') return '/login';
  const roles = Array.isArray(user.roles) ? user.roles.map(String) : [];
  const role = user.role ? String(user.role) : pickPrimaryRole(roles);
  if (!role) return '/login';
  return getDashboardPathForRole(role);
}
