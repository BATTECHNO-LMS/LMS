import { pickPrimaryRole } from '../auth/authUserMapper.js';

function formatLastLogin(value) {
  if (value == null) return '—';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

/**
 * Map API user list item to admin table row shape.
 * @param {Record<string, unknown>} u
 */
export function mapUserListRow(u) {
  const roles = Array.isArray(u.roles) ? u.roles.map(String) : [];
  const role = pickPrimaryRole(roles) ?? '';
  return {
    id: String(u.id ?? ''),
    name: String(u.full_name ?? ''),
    email: String(u.email ?? ''),
    role,
    roles,
    status: String(u.status ?? ''),
    lastLogin: formatLastLogin(u.last_login_at),
    primary_university_id: u.primary_university_id != null ? String(u.primary_university_id) : null,
    tenantId: u.primary_university_id != null ? String(u.primary_university_id) : null,
  };
}
