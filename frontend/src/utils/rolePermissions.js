import { ROLES, ADMIN_ROLE_SET } from '../constants/roles.js';
import { UI_PERMISSION } from '../constants/permissions.js';

const P = UI_PERMISSION;

/** Unknown path under role shell → always denied in hasUiPermission. */
export const UI_ROUTE_DENY = '__UI_ROUTE_DENY__';

/** Admin shell: all LMS UI capabilities enabled for visibility (real RBAC can narrow later). */
const ADMIN_ALL = Object.fromEntries(Object.values(P).map((k) => [k, true]));

const STUDENT = {
  [P.canViewDashboard]: true,
  [P.canViewEnrolledPrograms]: true,
  [P.canViewContent]: true,
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

const BY_ROLE = {
  [ROLES.STUDENT]: STUDENT,
  [ROLES.INSTRUCTOR]: INSTRUCTOR,
  [ROLES.UNIVERSITY_REVIEWER]: REVIEWER,
};

/**
 * @param {string | undefined} role
 * @returns {Record<string, boolean>}
 */
export function getUiPermissions(role) {
  if (role && ADMIN_ROLE_SET.includes(role)) return { ...ADMIN_ALL };
  return BY_ROLE[role] ?? STUDENT;
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
 * @param {{ role?: string, permissions?: string[] } | null | undefined} user
 * @param {string} key
 */
export function hasUiPermissionForUser(user, key) {
  if (!key) return true;
  if (key === UI_ROUTE_DENY) return false;
  const codes = Array.isArray(user?.permissions) ? user.permissions.map(String) : [];
  if (codes.includes('*') || codes.includes('ui.all')) {
    return Boolean(getUiPermissions(user?.role)[key]);
  }
  if (codes.includes(key)) return true;
  return hasUiPermission(user?.role, key);
}

/**
 * Ordered: most specific path patterns first.
 * @type {Array<[RegExp, string]>}
 */
const ROUTE_RULES = [
  [/^\/instructor\/assessments\/create\/?$/, P.canCreateAssessments],
  [/^\/instructor\/assessments\/[^/]+\/edit\/?$/, P.canEditAssessments],
  [/^\/student\/programs(\/|$)/, P.canViewEnrolledPrograms],
  [/^\/student\/content(\/|$)/, P.canViewContent],
  [/^\/student\/sessions(\/|$)/, P.canViewSessions],
  [/^\/student\/attendance(\/|$)/, P.canViewAttendance],
  [/^\/student\/assessments(\/|$)/, P.canViewAssessments],
  [/^\/student\/submissions(\/|$)/, P.canViewSubmissionStatus],
  [/^\/student\/grades(\/|$)/, P.canViewGrades],
  [/^\/student\/certificate(\/|$)/, P.canViewCertificates],
  [/^\/student\/dashboard\/?$/, P.canViewDashboard],

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
  if (!/^\/(student|instructor|reviewer)(\/|$)/.test(path)) {
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
  if (ADMIN_ROLE_SET.includes(role)) return true;
  const perm = getRouteUiPermission(pathname);
  if (perm === null) return true;
  if (perm === UI_ROUTE_DENY || !hasUiPermission(role, perm)) return false;
  return true;
}

/**
 * Same as {@link canAccessPathWithUiPermissions} but uses `/me` permissions when present.
 * @param {{ role?: string, permissions?: string[] } | null | undefined} user
 * @param {string} pathname
 */
export function canAccessPathWithUiPermissionsForUser(user, pathname) {
  const role = user?.role;
  if (!role) return false;
  if (ADMIN_ROLE_SET.includes(role)) return true;
  const perm = getRouteUiPermission(pathname);
  if (perm === null) return true;
  if (perm === UI_ROUTE_DENY || !hasUiPermissionForUser(user, perm)) return false;
  return true;
}
