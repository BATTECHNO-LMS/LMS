'use strict';

const { ApiError } = require('../../utils/apiError');
const { normalizeRoleCodes } = require('../../utils/roleCanon');

const REPORT_ACTIONS = Object.freeze({
  VIEW_REPORT: 'VIEW_REPORT',
  EXPORT_REPORT: 'EXPORT_REPORT',
  GENERATE_REPORT: 'GENERATE_REPORT',
  REGENERATE_REPORT: 'REGENERATE_REPORT',
  VIEW_REPORT_HISTORY: 'VIEW_REPORT_HISTORY',
});

const MSG = Object.freeze({
  forbidden: 'لا تملك صلاحية تنفيذ هذه العملية.',
  institution: 'لا تملك صلاحية الوصول إلى تقارير التدريب الميداني للجامعة.',
  universityRequired: 'لم يتم ربط حسابك بجامعة. لا يمكن عرض تقارير التدريب الميداني.',
  crossUniversity: 'غير مصرح بالوصول إلى بيانات جامعة أخرى',
  readOnly:
    'ليس لديك صلاحية إنشاء أو إعادة إنشاء التقارير. يمكنك عرض وتنزيل التقارير المتاحة فقط.',
});

function rolesOf(user) {
  const fromArray = Array.isArray(user?.roles) ? user.roles : [];
  const fromSingle = user?.role ? [user.role] : [];
  return normalizeRoleCodes(fromArray.length ? fromArray : fromSingle);
}

function isReportSuperAdmin(user) {
  return Boolean(user?.isGlobal) && rolesOf(user).includes('super_admin');
}

function isInstitutionContext(user) {
  return user?.portalType === 'INSTITUTION' || user?.organizationType === 'INSTITUTION';
}

function isUniversityAdmin(user) {
  if (isReportSuperAdmin(user) || isInstitutionContext(user)) return false;
  return rolesOf(user).includes('admin') && Boolean(user?.universityId);
}

function isReviewerOnly(user) {
  if (isReportSuperAdmin(user) || isUniversityAdmin(user)) return false;
  return rolesOf(user).includes('reviewer') && Boolean(user?.universityId);
}

function buildReportCapabilities(user) {
  const superAdmin = isReportSuperAdmin(user);
  const uniAdmin = isUniversityAdmin(user);
  const reviewer = isReviewerOnly(user);
  const canStaff = superAdmin || uniAdmin || reviewer;
  return {
    canViewUniversityReport: canStaff,
    canViewStudentReport: canStaff,
    canExportPdf: canStaff,
    canExportExcel: canStaff,
    canPrint: canStaff,
    canGenerate: superAdmin || uniAdmin,
    canRegenerate: superAdmin || uniAdmin,
    canViewHistory: canStaff,
    canDelete: false,
    canSelectUniversity: superAdmin,
    includeRawExcel: superAdmin || uniAdmin,
    readOnly: reviewer,
    roleContext: superAdmin ? 'super_admin' : uniAdmin ? 'admin' : reviewer ? 'reviewer' : null,
  };
}

function hasStaffReportRole(user) {
  return isReportSuperAdmin(user) || isUniversityAdmin(user) || isReviewerOnly(user);
}

/**
 * Server-side guard for UNIVERSITY field-training reports.
 * Super-admin (isGlobal + super_admin) may omit universityId; everyone else must match their assignment.
 */
function verifyUniversityFieldTrainingReportAccess({
  user,
  requestedUniversityId = null,
  action = REPORT_ACTIONS.VIEW_REPORT,
} = {}) {
  if (!user) {
    throw new ApiError(401, 'يجب تسجيل الدخول للمتابعة.', null, 'UNAUTHORIZED');
  }

  const roles = rolesOf(user);

  if (isInstitutionContext(user) && !isReportSuperAdmin(user)) {
    throw new ApiError(403, MSG.institution, null, 'PORTAL_MISMATCH');
  }

  const blocked = ['trainer', 'trainee', 'instructor', 'student'].filter((role) => roles.includes(role));
  const staff = hasStaffReportRole(user);
  if (blocked.length && !staff) {
    throw new ApiError(403, MSG.forbidden, null, 'FIELD_TRAINING_FORBIDDEN');
  }

  if (!staff) {
    if (roles.includes('admin') || roles.includes('reviewer')) {
      throw new ApiError(403, MSG.universityRequired, null, 'UNIVERSITY_REQUIRED');
    }
    throw new ApiError(403, MSG.forbidden, null, 'FIELD_TRAINING_FORBIDDEN');
  }

  const writeActions = [REPORT_ACTIONS.GENERATE_REPORT, REPORT_ACTIONS.REGENERATE_REPORT];
  if (writeActions.includes(action) && isReviewerOnly(user)) {
    throw new ApiError(403, MSG.readOnly, null, 'REPORT_READ_ONLY');
  }

  const capabilities = buildReportCapabilities(user);

  if (isReportSuperAdmin(user)) {
    return {
      universityId: requestedUniversityId || null,
      capabilities,
    };
  }

  const uni = user.universityId;
  if (!uni) {
    throw new ApiError(403, MSG.universityRequired, null, 'UNIVERSITY_REQUIRED');
  }
  if (requestedUniversityId && String(requestedUniversityId) !== String(uni)) {
    throw new ApiError(403, MSG.crossUniversity, null, 'FIELD_TRAINING_UNIVERSITY_FORBIDDEN');
  }

  return { universityId: uni, capabilities };
}

module.exports = {
  REPORT_ACTIONS,
  MSG,
  rolesOf,
  isReportSuperAdmin,
  isInstitutionContext,
  isUniversityAdmin,
  isReviewerOnly,
  buildReportCapabilities,
  verifyUniversityFieldTrainingReportAccess,
};
