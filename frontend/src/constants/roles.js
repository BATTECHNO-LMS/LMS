/**
 * Application roles — aligned with future RBAC.
 */
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  PROGRAM_ADMIN: 'program_admin',
  ACADEMIC_ADMIN: 'academic_admin',
  QA_OFFICER: 'qa_officer',
  INSTRUCTOR: 'instructor',
  STUDENT: 'student',
  UNIVERSITY_REVIEWER: 'university_reviewer',
};

/** Roles that use the admin dashboard shell */
export const ADMIN_ROLE_SET = [
  ROLES.SUPER_ADMIN,
  ROLES.PROGRAM_ADMIN,
  ROLES.ACADEMIC_ADMIN,
  ROLES.QA_OFFICER,
];

/** Mock login presets for development */
export const MOCK_LOGIN_PRESETS = {
  admin: {
    key: 'admin',
    labelAr: 'مسؤول',
    labelEn: 'Admin',
    role: ROLES.SUPER_ADMIN,
  },
  instructor: {
    key: 'instructor',
    labelAr: 'مدرّس',
    labelEn: 'Instructor',
    role: ROLES.INSTRUCTOR,
  },
  student: {
    key: 'student',
    labelAr: 'طالب',
    labelEn: 'Student',
    role: ROLES.STUDENT,
  },
  reviewer: {
    key: 'reviewer',
    labelAr: 'مراجع جامعي',
    labelEn: 'University reviewer',
    role: ROLES.UNIVERSITY_REVIEWER,
  },
};

export const MOCK_PRESET_ORDER = [
  MOCK_LOGIN_PRESETS.admin,
  MOCK_LOGIN_PRESETS.instructor,
  MOCK_LOGIN_PRESETS.student,
  MOCK_LOGIN_PRESETS.reviewer,
];
