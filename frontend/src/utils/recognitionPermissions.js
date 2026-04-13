function roleCodes(user) {
  const raw = Array.isArray(user?.roles) && user.roles.length ? user.roles : user?.role ? [user.role] : [];
  return raw.map((r) => String(r).toLowerCase());
}

/** Matches backend RECOGNITION_WRITE (no reviewer). */
export function canWriteRecognitionRequest(user) {
  return roleCodes(user).some((r) =>
    ['super_admin', 'program_admin', 'university_admin', 'academic_admin'].includes(r)
  );
}

/** Matches backend PATCH /status (includes reviewer). */
export function canPatchRecognitionStatus(user) {
  return roleCodes(user).some((r) =>
    ['super_admin', 'program_admin', 'university_admin', 'academic_admin', 'university_reviewer'].includes(r)
  );
}
