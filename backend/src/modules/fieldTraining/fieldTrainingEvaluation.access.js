'use strict';

const { ApiError } = require('../../utils/apiError');
const { isSystemWideAdmin } = require('../../utils/universityScope');
const reportAccess = require('./fieldTrainingReport.access');
const ftAccess = require('./fieldTraining.access');

const EVAL_ACTIONS = Object.freeze({
  MANAGE_TEMPLATES: 'MANAGE_TEMPLATES',
  MANAGE_POLICY: 'MANAGE_POLICY',
  ASSIGN_OPPORTUNITY_TEMPLATE: 'ASSIGN_OPPORTUNITY_TEMPLATE',
  VIEW_REPORTS: 'VIEW_REPORTS',
  GENERATE: 'GENERATE',
  REGENERATE: 'REGENERATE',
  DOWNLOAD: 'DOWNLOAD',
  BULK_ZIP: 'BULK_ZIP',
  MANAGE_RATINGS: 'MANAGE_RATINGS',
  EDIT_COMMENTS: 'EDIT_COMMENTS',
});

const MSG = Object.freeze({
  forbidden: 'لا تملك صلاحية تنفيذ هذه العملية.',
  institution: 'لا تملك صلاحية الوصول إلى تقييم التدريب الميداني للجامعة.',
  universityRequired: 'لم يتم ربط حسابك بجامعة.',
  crossUniversity: 'غير مصرح بالوصول إلى بيانات جامعة أخرى',
  readOnly: 'ليس لديك صلاحية تعديل القوالب أو إعادة إنشاء التقارير.',
  instructorUnassigned: 'غير مصرح. هذه الفرصة غير مسندة إليك.',
  studentOwnOnly: 'يمكنك تنزيل تقريرك النهائي فقط.',
});

function rolesOf(user) {
  return reportAccess.rolesOf(user);
}

function isSuperAdmin(user) {
  return isSystemWideAdmin(user) || reportAccess.isReportSuperAdmin(user);
}

function isInstitutionDenied(user) {
  return reportAccess.isInstitutionContext(user) && !isSuperAdmin(user);
}

function isUniversityAdmin(user) {
  return reportAccess.isUniversityAdmin(user);
}

function isReviewer(user) {
  return reportAccess.isReviewerOnly(user);
}

function isInstructor(user) {
  return rolesOf(user).includes('instructor');
}

function isStudent(user) {
  return rolesOf(user).includes('student') && !isSuperAdmin(user) && !isUniversityAdmin(user) && !isReviewer(user);
}

function denyInstitution() {
  throw new ApiError(403, MSG.institution, null, 'PORTAL_MISMATCH');
}

function requireUniversityScope(user, requestedUniversityId) {
  if (isSuperAdmin(user)) {
    return requestedUniversityId || null;
  }
  const uni = user?.universityId;
  if (!uni) {
    throw new ApiError(403, MSG.universityRequired, null, 'UNIVERSITY_REQUIRED');
  }
  if (requestedUniversityId && String(requestedUniversityId) !== String(uni)) {
    throw new ApiError(403, MSG.crossUniversity, null, 'FIELD_TRAINING_UNIVERSITY_FORBIDDEN');
  }
  return uni;
}

function assertNotBlockedPortal(user) {
  if (!user) throw new ApiError(401, 'يجب تسجيل الدخول للمتابعة.', null, 'UNAUTHORIZED');
  if (isInstitutionDenied(user)) denyInstitution();
  const roles = rolesOf(user);
  const blocked = ['trainer', 'trainee'].filter((role) => roles.includes(role));
  if (blocked.length && !isSuperAdmin(user) && !isUniversityAdmin(user) && !isReviewer(user) && !isInstructor(user) && !isStudent(user)) {
    throw new ApiError(403, MSG.forbidden, null, 'FIELD_TRAINING_FORBIDDEN');
  }
  if ((roles.includes('trainer') || roles.includes('trainee')) && !isSuperAdmin(user) && !isUniversityAdmin(user)) {
    throw new ApiError(403, MSG.forbidden, null, 'FIELD_TRAINING_FORBIDDEN');
  }
}

function assertCanManageUniversityTemplates(user, universityId) {
  assertNotBlockedPortal(user);
  if (isSuperAdmin(user)) return { universityId: universityId || null, write: true };
  if (isUniversityAdmin(user)) {
    return { universityId: requireUniversityScope(user, universityId), write: true };
  }
  throw new ApiError(403, MSG.forbidden, null, 'FIELD_TRAINING_FORBIDDEN');
}

function assertCanManagePolicy(user, universityId) {
  return assertCanManageUniversityTemplates(user, universityId);
}

function assertCanViewReports(user, universityId) {
  assertNotBlockedPortal(user);
  if (isInstructor(user) && !isUniversityAdmin(user) && !isSuperAdmin(user) && !isReviewer(user)) {
    return { universityId: user.universityId || universityId || null, write: false, instructor: true };
  }
  const access = reportAccess.verifyUniversityFieldTrainingReportAccess({
    user,
    requestedUniversityId: universityId,
    action: reportAccess.REPORT_ACTIONS.VIEW_REPORT,
  });
  return { ...access, write: !access.capabilities?.readOnly };
}

function assertCanGenerate(user, opportunity) {
  assertNotBlockedPortal(user);
  if (isReviewer(user)) {
    throw new ApiError(403, MSG.readOnly, null, 'REPORT_READ_ONLY');
  }
  if (isSuperAdmin(user)) return;
  if (isUniversityAdmin(user)) {
    requireUniversityScope(user, opportunity?.university_id);
    return;
  }
  if (isInstructor(user) && ftAccess.isAssignedInstructor(user, opportunity)) {
    return;
  }
  throw new ApiError(403, MSG.instructorUnassigned, null, 'FIELD_TRAINING_FORBIDDEN');
}

function assertCanAssignOpportunityTemplate(user, opportunity) {
  assertCanGenerate(user, opportunity);
}

function assertCanDownloadEvaluation(user, evaluation) {
  assertNotBlockedPortal(user);
  if (isStudent(user)) {
    if (String(evaluation.student_id) !== String(user.userId)) {
      throw new ApiError(403, MSG.studentOwnOnly, null, 'FIELD_TRAINING_FORBIDDEN');
    }
    return;
  }
  if (isInstructor(user) && !isUniversityAdmin(user) && !isSuperAdmin(user) && !isReviewer(user)) {
    return { instructor: true };
  }
  reportAccess.verifyUniversityFieldTrainingReportAccess({
    user,
    requestedUniversityId: evaluation.university_id,
    action: reportAccess.REPORT_ACTIONS.VIEW_REPORT,
  });
}

function assertCanBulkZip(user, universityId) {
  assertNotBlockedPortal(user);
  if (isStudent(user) || rolesOf(user).includes('trainer') || rolesOf(user).includes('trainee')) {
    throw new ApiError(403, MSG.forbidden, null, 'FIELD_TRAINING_FORBIDDEN');
  }
  if (isInstructor(user) && !isUniversityAdmin(user) && !isSuperAdmin(user) && !isReviewer(user)) {
    return { universityId: user.universityId || universityId || null, instructor: true };
  }
  return reportAccess.verifyUniversityFieldTrainingReportAccess({
    user,
    requestedUniversityId: universityId,
    action: reportAccess.REPORT_ACTIONS.EXPORT_REPORT,
  });
}

function filterEvaluationsForZip(user, rows, { assignedOpportunityIds = null } = {}) {
  const scopedUni = isSuperAdmin(user) ? null : user?.universityId;
  return (rows || []).filter((row) => {
    if (scopedUni && String(row.university_id) !== String(scopedUni)) return false;
    if (isInstructor(user) && !isUniversityAdmin(user) && !isSuperAdmin(user) && !isReviewer(user)) {
      if (!assignedOpportunityIds) return false;
      return assignedOpportunityIds.has(String(row.opportunity_id));
    }
    return true;
  });
}

module.exports = {
  EVAL_ACTIONS,
  MSG,
  rolesOf,
  isSuperAdmin,
  isInstitutionDenied,
  isUniversityAdmin,
  isReviewer,
  isInstructor,
  isStudent,
  requireUniversityScope,
  assertNotBlockedPortal,
  assertCanManageUniversityTemplates,
  assertCanManagePolicy,
  assertCanViewReports,
  assertCanGenerate,
  assertCanAssignOpportunityTemplate,
  assertCanDownloadEvaluation,
  assertCanBulkZip,
  filterEvaluationsForZip,
};
