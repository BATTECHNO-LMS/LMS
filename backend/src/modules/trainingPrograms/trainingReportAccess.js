'use strict';

const { ApiError } = require('../../utils/apiError');
const { assertOrganizationAccess, isSystemWideAdmin } = require('../../utils/organizationScope');
const { REPORT_TYPES } = require('./trainingReportMetrics.service');
const { isTrainerOnly, assertTrainerProgramAccess } = require('./trainerGuards');

function isReviewerOnly(requester) {
  return (
    Boolean(requester?.roles?.includes('reviewer')) &&
    !requester?.roles?.includes('admin') &&
    !isSystemWideAdmin(requester)
  );
}

function isTrainee(requester) {
  return Boolean(requester?.roles?.includes('trainee') || requester?.roles?.includes('student'));
}

function isManager(requester) {
  return isSystemWideAdmin(requester) || Boolean(requester?.roles?.includes('admin'));
}

/**
 * Verify requester may view/export a report of the given type for the given program scope.
 * Trainee: own INDIVIDUAL only. Trainer: assigned program + can_view_reports.
 * Institution admin / super admin: org scope. Reviewer: read-only within org.
 */
async function verifyReportAccess(requester, { program, reportType, enrollment, allowGenerate = false }) {
  if (!program) throw new ApiError(404, 'الدورة التدريبية غير موجودة', null, 'TRAINING_PROGRAM_NOT_FOUND');
  assertOrganizationAccess(requester, program.organization_id);

  if (allowGenerate && isReviewerOnly(requester)) {
    throw new ApiError(403, 'المراجع بصلاحية قراءة فقط ولا يمكنه توليد التقارير.', null, 'ROLE_NOT_ALLOWED');
  }

  if (isTrainee(requester) && !isManager(requester) && !isTrainerOnly(requester)) {
    if (reportType !== REPORT_TYPES.INDIVIDUAL) {
      throw new ApiError(403, 'المتدرب يمكنه الاطلاع على تقريره الفردي فقط.', null, 'ROLE_NOT_ALLOWED');
    }
    if (!enrollment || enrollment.user_id !== requester.userId) {
      throw new ApiError(403, 'لا يمكن الاطلاع على تقرير متدرب آخر.', null, 'ROLE_NOT_ALLOWED');
    }
    if (allowGenerate) {
      throw new ApiError(403, 'توليد التقارير غير متاح للمتدرب.', null, 'ROLE_NOT_ALLOWED');
    }
    return { role: 'trainee', canExportRaw: false, canViewComments: false };
  }

  if (isTrainerOnly(requester)) {
    await assertTrainerProgramAccess(requester, program.id, 'can_view_reports');
    if (reportType === REPORT_TYPES.INDIVIDUAL && enrollment) {
      if (enrollment.organization_id !== program.organization_id) {
        throw new ApiError(403, 'Forbidden', null, 'ROLE_NOT_ALLOWED');
      }
    }
    return {
      role: 'trainer',
      canExportRaw: false,
      canViewComments: true,
      readOnly: false,
    };
  }

  if (isReviewerOnly(requester)) {
    return { role: 'reviewer', canExportRaw: false, canViewComments: true, readOnly: true };
  }

  if (isManager(requester)) {
    return { role: 'admin', canExportRaw: true, canViewComments: true, readOnly: false };
  }

  throw new ApiError(403, 'Forbidden', null, 'ROLE_NOT_ALLOWED');
}

module.exports = {
  isTrainerOnly,
  isReviewerOnly,
  isTrainee,
  isManager,
  assertTrainerProgramAccess,
  verifyReportAccess,
};
