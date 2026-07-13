import { pickPrimaryRole } from '../auth/authUserMapper.js';

function formatDateTime(value) {
  if (value == null) return '—';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

function formatDate(value) {
  if (value == null) return '—';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

function specialtyLabel(spec) {
  if (!spec) return '';
  return spec.name_ar || spec.name_en || spec.code || '';
}

/**
 * Map API user list item to admin table/card row shape.
 * @param {Record<string, unknown>} u
 */
export function mapUserListRow(u) {
  const roles = Array.isArray(u.roles) ? u.roles.map(String) : [];
  const role = pickPrimaryRole(roles) ?? '';
  const uni = u.primary_university || null;
  const uspec = u.university_specialty || null;
  const spec = u.specialty || null;
  return {
    id: String(u.id ?? ''),
    name: String(u.full_name ?? ''),
    email: String(u.email ?? ''),
    phone: u.phone != null ? String(u.phone) : '',
    role,
    roles,
    status: String(u.status ?? ''),
    lastLogin: formatDateTime(u.last_login_at),
    createdAt: formatDate(u.created_at),
    emailVerified: Boolean(u.email_verified_at),
    emailVerifiedAt: u.email_verified_at ?? null,
    primary_university_id: u.primary_university_id != null ? String(u.primary_university_id) : null,
    tenantId: u.primary_university_id != null ? String(u.primary_university_id) : null,
    universityName: uni?.name || '',
    specialtyName: specialtyLabel(uspec) || specialtyLabel(spec) || '',
    university_specialty_id:
      u.university_specialty_id != null ? String(u.university_specialty_id) : null,
    specialty_id: u.specialty_id != null ? String(u.specialty_id) : null,
  };
}
