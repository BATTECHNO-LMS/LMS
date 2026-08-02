import {
  ROLES,
  ADMIN_ROLE_SET,
  isLegacyDeprecatedRole,
  canonicalizeRoleCode,
  normalizeRoleCodes,
} from '../constants/roles.js';
import { UI_PERMISSION } from '../constants/permissions.js';
import { resolveAccessRoleForPath, getUserRoleCodes, getActiveRoleCode } from './authRouting.js';

const P = UI_PERMISSION;

/** Unknown path under role shell → always denied in hasUiPermission. */
export const UI_ROUTE_DENY = '__UI_ROUTE_DENY__';

/** Admin shell: all LMS UI capabilities enabled for visibility (real RBAC can narrow later). */
const ADMIN_ALL = Object.fromEntries(Object.values(P).map((k) => [k, true]));

/** Deprecated roles fail closed — no student fallback. */
const DENY_ALL = Object.fromEntries(Object.values(P).map((k) => [k, false]));

const STUDENT = {
  [P.canViewDashboard]: true,
  [P.canViewEnrolledPrograms]: true,
  [P.canViewContent]: true,
  [P.canViewCourses]: true,
  [P.canViewFieldTraining]: true,
  [P.canViewSessions]: true,
  [P.canViewAttendance]: true,
  [P.canViewAssessments]: true,
  [P.canSubmitAssessments]: true,
  [P.canEditOwnSubmission]: true,
  [P.canViewFeedback]: true,
  [P.canViewSubmissionStatus]: true,
  [P.canViewGrades]: true,
  [P.canViewCertificates]: true,
  [P.canManageCohorts]: false,
  [P.canManageSessions]: false,
  [P.canManageAttendance]: false,
  [P.canCreateAssessments]: false,
  [P.canEditAssessments]: false,
  [P.canManageRubric]: false,
  [P.canGradeAssessments]: false,
  [P.canPublishFeedback]: false,
  [P.canViewSubmissionsTeaching]: false,
  [P.canViewGradesTeaching]: false,
  [P.canUploadEvidence]: false,
  [P.canManageRiskStudents]: false,
  [P.canViewRecognitionRequests]: false,
  [P.canViewUniversityReports]: false,
  [P.canViewReviewerEvidence]: false,
  [P.canViewLinkedCertificates]: false,
  [P.canViewNotifications]: true,
};

const INSTRUCTOR = {
  [P.canViewDashboard]: true,
  [P.canViewEnrolledPrograms]: false,
  [P.canViewContent]: false,
  [P.canViewSessions]: true,
  [P.canViewAttendance]: true,
  [P.canViewAssessments]: true,
  [P.canSubmitAssessments]: false,
  [P.canEditOwnSubmission]: false,
  [P.canViewFeedback]: false,
  [P.canViewSubmissionStatus]: false,
  [P.canViewGrades]: false,
  [P.canViewCertificates]: false,
  [P.canManageCohorts]: true,
  [P.canManageSessions]: true,
  [P.canManageAttendance]: true,
  [P.canCreateAssessments]: true,
  [P.canEditAssessments]: true,
  [P.canManageRubric]: true,
  [P.canGradeAssessments]: true,
  [P.canPublishFeedback]: true,
  [P.canViewSubmissionsTeaching]: true,
  [P.canViewGradesTeaching]: true,
  [P.canViewFieldTraining]: true,
  [P.canUploadEvidence]: true,
  [P.canManageRiskStudents]: true,
  [P.canViewRecognitionRequests]: false,
  [P.canViewUniversityReports]: false,
  [P.canViewReviewerEvidence]: false,
  [P.canViewLinkedCertificates]: false,
  [P.canViewNotifications]: true,
};

const REVIEWER = {
  ...Object.fromEntries(Object.values(P).map((k) => [k, false])),
  [P.canViewDashboard]: true,
  [P.canViewRecognitionRequests]: true,
  [P.canViewUniversityReports]: true,
  [P.canViewReviewerEvidence]: true,
  [P.canViewLinkedCertificates]: true,
  [P.canViewNotifications]: true,
};

const TRAINEE = {
  ...STUDENT,
  [P.canViewFieldTraining]: false,
};

const BY_ROLE = {
  [ROLES.STUDENT]: STUDENT,
  [ROLES.TRAINEE]: TRAINEE,
  [ROLES.INSTRUCTOR]: INSTRUCTOR,
  [ROLES.REVIEWER]: REVIEWER,
};

/**
 * @param {string | undefined} role
 * @returns {Record<string, boolean>}
 */
export function getUiPermissions(role) {
  const code = canonicalizeRoleCode(role);
  if (!code) return { ...STUDENT };
  if (code && ADMIN_ROLE_SET.includes(code)) return { ...ADMIN_ALL };
  return BY_ROLE[code] ?? STUDENT;
}

/**
 * @param {string | undefined} role
 * @param {string} key
 */
export function hasUiPermission(role, key) {
  if (!key) return true;
  if (key === UI_ROUTE_DENY) return false;
  return Boolean(getUiPermissions(role)[key]);
}

/**
 * UI permission check using `/api/auth/me` payload when present: backend `permissions`
 * codes can match a {@link UI_PERMISSION} value; `*` / `ui.all` grant the full role matrix.
 * Otherwise falls back to role-only {@link hasUiPermission}.
 * @param {{ role?: string, roles?: string[], permissions?: string[] } | null | undefined} user
 * @param {string} key
 * @param {string | null | undefined} [accessRole] role to evaluate matrix for (e.g. shell role)
 */
export function hasUiPermissionForUser(user, key, accessRole = null) {
  if (!key) return true;
  if (key === UI_ROUTE_DENY) return false;
  const role = canonicalizeRoleCode(accessRole) || canonicalizeRoleCode(user?.role);
  const codes = Array.isArray(user?.permissions) ? user.permissions.map(String) : [];
  if (codes.includes('*') || codes.includes('ui.all')) {
    return Boolean(getUiPermissions(role)[key]);
  }
  if (codes.includes(key)) return true;
  // Multi-role: grant if any held role has the UI capability
  const roles = Array.isArray(user?.roles) ? normalizeRoleCodes(user.roles.map(String)) : [];
  if (roles.length > 1) {
    if (roles.some((r) => hasUiPermission(r, key))) return true;
  }
  return hasUiPermission(role, key);
}

/**
 * Ordered: most specific path patterns first.
 * @type {Array<[RegExp, string]>}
 */
const ROUTE_RULES = [
  [/^\/instructor\/assessments\/create\/?$/, P.canCreateAssessments],
  [/^\/instructor\/assessments\/[^/]+\/edit\/?$/, P.canEditAssessments],
  [/^\/student\/training-programs\/?$/, P.canViewEnrolledPrograms],
  [/^\/student\/programs\/[^/]+(\/|$)/, P.canViewEnrolledPrograms],
  [/^\/student\/available-cohorts\/?$/, P.canViewEnrolledPrograms],
  [/^\/student\/semester-schedule\/?$/, P.canViewEnrolledPrograms],
  [/^\/student\/?$/, P.canViewDashboard],
  [/^\/student\/programs\/?$/, P.canViewEnrolledPrograms],
  [/^\/student\/content(\/|$)/, P.canViewContent],
  [/^\/student\/courses(\/|$)/, P.canViewCourses],
  [/^\/student\/field-training(\/|$)/, P.canViewFieldTraining],
  [/^\/student\/sessions(\/|$)/, P.canViewSessions],
  [/^\/student\/attendance(\/|$)/, P.canViewAttendance],
  [/^\/student\/assessments(\/|$)/, P.canViewAssessments],
  [/^\/student\/submissions(\/|$)/, P.canViewSubmissionStatus],
  [/^\/student\/grades(\/|$)/, P.canViewGrades],
  [/^\/student\/certificate(\/|$)/, P.canViewCertificates],
  [/^\/student\/dashboard\/?$/, P.canViewDashboard],

  [/^\/trainee\/courses\/[^/]+(\/|$)/, P.canViewEnrolledPrograms],
  [/^\/trainee\/courses\/?$/, P.canViewEnrolledPrograms],
  [/^\/trainee\/certificates(\/|$)/, P.canViewCertificates],
  [/^\/trainee\/notifications(\/|$)/, P.canViewNotifications],
  [/^\/trainee\/user-guide(\/|$)/, P.canViewDashboard],
  [/^\/trainee\/profile\/?$/, P.canViewDashboard],
  [/^\/trainee\/?$/, P.canViewDashboard],

  [/^\/instructor\/field-training(\/|$)/, P.canViewFieldTraining],
  [/^\/instructor\/risk-students(\/|$)/, P.canManageRiskStudents],
  [/^\/instructor\/evidence(\/|$)/, P.canUploadEvidence],
  [/^\/instructor\/grades(\/|$)/, P.canViewGradesTeaching],
  [/^\/instructor\/submissions(\/|$)/, P.canViewSubmissionsTeaching],
  [/^\/instructor\/assessments(\/|$)/, P.canViewAssessments],
  [/^\/instructor\/attendance(\/|$)/, P.canManageAttendance],
  [/^\/instructor\/sessions(\/|$)/, P.canManageSessions],
  [/^\/instructor\/cohorts(\/|$)/, P.canManageCohorts],
  [/^\/instructor\/enrollments(\/|$)/, P.canManageCohorts],
  [/^\/instructor\/dashboard\/?$/, P.canViewDashboard],

  [/^\/reviewer\/recognition-requests(\/|$)/, P.canViewRecognitionRequests],
  [/^\/reviewer\/university-reports(\/|$)/, P.canViewUniversityReports],
  [/^\/reviewer\/evidence(\/|$)/, P.canViewReviewerEvidence],
  [/^\/reviewer\/certificates(\/|$)/, P.canViewLinkedCertificates],
  [/^\/reviewer\/enrollment-requests(\/|$)/, P.canViewUniversityReports],
  [/^\/reviewer\/dashboard\/?$/, P.canViewDashboard],

  [/^\/student\/notifications(\/|$)/, P.canViewNotifications],
  [/^\/instructor\/notifications(\/|$)/, P.canViewNotifications],
  [/^\/reviewer\/notifications(\/|$)/, P.canViewNotifications],
];

/**
 * Required UI permission for a pathname under /student | /instructor | /reviewer.
 * Null if path is outside those shells (no UI map applied).
 * @param {string} pathname
 * @returns {string | null}
 */
export function getRouteUiPermission(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (!/^\/(student|trainee|instructor|reviewer)(\/|$)/.test(path)) {
    return null;
  }
  for (const [re, perm] of ROUTE_RULES) {
    if (re.test(path)) return perm;
  }
  return UI_ROUTE_DENY;
}

/**
 * Whether role may access path for UI (student/instructor/reviewer shells).
 * @param {string | undefined} role
 * @param {string} pathname
 */
export function canAccessPathWithUiPermissions(role, pathname) {
  if (!role) return false;
  if (isLegacyDeprecatedRole(role)) return false;
  if (ADMIN_ROLE_SET.includes(role)) return true;
  const perm = getRouteUiPermission(pathname);
  if (perm === null) return true;
  if (perm === UI_ROUTE_DENY || !hasUiPermission(role, perm)) return false;
  return true;
}

/**
 * Same as {@link canAccessPathWithUiPermissions} but uses `/me` permissions when present.
 * Uses shell role when the user holds it (multi-role safe).
 * @param {{ role?: string, roles?: string[], permissions?: string[] } | null | undefined} user
 * @param {string} pathname
 */
export function canAccessPathWithUiPermissionsForUser(user, pathname) {
  const codes = getUserRoleCodes(user);
  if (!codes.length) return false;
  if (codes.some((r) => isLegacyDeprecatedRole(r)) && !codes.some((r) => !isLegacyDeprecatedRole(r))) {
    return false;
  }
  if (codes.some((r) => ADMIN_ROLE_SET.includes(r))) return true;
  const accessRole = resolveAccessRoleForPath(user, pathname) || getActiveRoleCode(user);
  if (!accessRole) return false;
  if (isLegacyDeprecatedRole(accessRole)) return false;
  const perm = getRouteUiPermission(pathname);
  if (perm === null) return true;
  if (perm === UI_ROUTE_DENY || !hasUiPermissionForUser(user, perm, accessRole)) return false;
  return true;
}
