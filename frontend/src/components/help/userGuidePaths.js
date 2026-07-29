/**
 * Resolve role-based user guide base path.
 * @param {{ role?: string } | null | undefined} user
 * @param {string} [pathname]
 */
export function getUserGuideBasePath(user, pathname = '') {
  const fromPath = String(pathname || '');
  if (fromPath.startsWith('/instructor/')) return '/instructor/user-guide';
  if (fromPath.startsWith('/reviewer/')) return '/reviewer/user-guide';
  if (fromPath.startsWith('/admin/')) return '/admin/content-hub/help';
  if (fromPath.startsWith('/student/')) return '/student/user-guide';

  const role = String(user?.role || '').toLowerCase();
  if (role === 'instructor') return '/instructor/user-guide';
  if (role === 'reviewer') return '/reviewer/user-guide';
  if (role === 'admin' || role === 'super_admin') return '/admin/content-hub/help';
  return '/student/user-guide';
}
