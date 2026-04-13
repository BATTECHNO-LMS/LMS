function roleCodes(user) {
  const raw = Array.isArray(user?.roles) && user.roles.length ? user.roles : user?.role ? [user.role] : [];
  return raw.map((r) => String(r).toLowerCase());
}

/** Aligned with backend CERTIFICATE_WRITE_ROLE_CODES default. */
export function canWriteCertificate(user) {
  return roleCodes(user).some((r) =>
    ['super_admin', 'program_admin', 'university_admin', 'academic_admin'].includes(r)
  );
}
