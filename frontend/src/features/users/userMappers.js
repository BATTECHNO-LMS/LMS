/**
 * Map API user list item to admin table row shape.
 * @param {Record<string, unknown>} u
 */
export function mapUserListRow(u) {
  const roles = Array.isArray(u.roles) ? u.roles.map(String) : [];
  const role = roles[0] ?? '';
  return {
    id: String(u.id ?? ''),
    name: String(u.full_name ?? ''),
    email: String(u.email ?? ''),
    role,
    roles,
    status: String(u.status ?? ''),
    lastLogin: '—',
    primary_university_id: u.primary_university_id != null ? String(u.primary_university_id) : null,
    tenantId: u.primary_university_id != null ? String(u.primary_university_id) : null,
  };
}
