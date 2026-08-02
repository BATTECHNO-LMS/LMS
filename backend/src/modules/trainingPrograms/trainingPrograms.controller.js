'use strict';

const service = require('./trainingPrograms.service');
const { success, created } = require('../../utils/apiResponse');

const R = (req) => req.user;

async function listPrograms(req, res, next) {
  try {
    return success(res, await service.listPrograms(R(req), req.validated.params.organizationId));
  } catch (e) {
    return next(e);
  }
}
async function listTrainingCourses(req, res, next) {
  try {
    return success(res, await service.listTrainingCourses(R(req), req.validated?.query || req.query || {}));
  } catch (e) {
    return next(e);
  }
}
async function getProgram(req, res, next) {
  try {
    return success(res, await service.getProgram(R(req), req.validated.params.programId));
  } catch (e) {
    return next(e);
  }
}
async function createProgram(req, res, next) {
  try {
    return created(res, await service.createProgram(R(req), req.validated.params.organizationId, req.validated.body));
  } catch (e) {
    return next(e);
  }
}
async function updateProgram(req, res, next) {
  try {
    return success(
      res,
      await service.updateProgram(
        R(req),
        req.validated.params.programId,
        req.validated?.body ?? req.body ?? {}
      )
    );
  } catch (e) {
    return next(e);
  }
}
async function listCohorts(req, res, next) {
  try {
    return success(res, await service.listCohorts(R(req), req.validated.params.programId));
  } catch (e) {
    return next(e);
  }
}
async function createCohort(req, res, next) {
  try {
    return created(res, await service.createCohort(R(req), req.validated.params.programId, req.validated.body));
  } catch (e) {
    return next(e);
  }
}
async function listEnrollments(req, res, next) {
  try {
    return success(res, await service.listEnrollments(R(req), req.validated.params.cohortId));
  } catch (e) {
    return next(e);
  }
}
async function enrollUser(req, res, next) {
  try {
    return created(res, await service.enrollUser(R(req), req.validated.params.cohortId, req.validated.body));
  } catch (e) {
    return next(e);
  }
}
async function importPreview(req, res, next) {
  try {
    return success(
      res,
      await service.importEnrollmentsPreview(R(req), req.validated.params.cohortId, req.validated.body.rows)
    );
  } catch (e) {
    return next(e);
  }
}
async function importCommit(req, res, next) {
  try {
    return created(
      res,
      await service.importEnrollmentsCommit(R(req), req.validated.params.cohortId, req.validated.body.rows)
    );
  } catch (e) {
    return next(e);
  }
}
async function listCohortSessions(req, res, next) {
  try {
    return success(res, await service.listCohortSessions(R(req), req.validated.params.cohortId));
  } catch (e) {
    return next(e);
  }
}
async function listProgramTasks(req, res, next) {
  try {
    return success(res, await service.listProgramTasks(R(req), req.validated.params.programId));
  } catch (e) {
    return next(e);
  }
}
async function listProgramAssessments(req, res, next) {
  try {
    return success(res, await service.listProgramAssessments(R(req), req.validated.params.programId));
  } catch (e) {
    return next(e);
  }
}
async function createSession(req, res, next) {
  try {
    return created(res, await service.createSession(R(req), req.validated.params.cohortId, req.validated.body));
  } catch (e) {
    return next(e);
  }
}
async function openAttendanceWindow(req, res, next) {
  try {
    return created(res, await service.openAttendanceWindow(R(req), req.validated.params.sessionId, req.body || {}));
  } catch (e) {
    return next(e);
  }
}
async function confirmAttendance(req, res, next) {
  try {
    return success(res, await service.confirmAttendance(R(req), req.validated.params.sessionId, req.body?.code));
  } catch (e) {
    return next(e);
  }
}
async function markAllPresent(req, res, next) {
  try {
    return success(res, await service.markAllPresent(R(req), req.validated.params.sessionId, req.body || {}));
  } catch (e) {
    return next(e);
  }
}
async function createTask(req, res, next) {
  try {
    return created(res, await service.createTask(R(req), req.validated.params.programId, req.body || {}));
  } catch (e) {
    return next(e);
  }
}
async function submitTask(req, res, next) {
  try {
    return created(res, await service.submitTask(R(req), req.validated.params.taskId, req.body || {}));
  } catch (e) {
    return next(e);
  }
}
async function gradeTask(req, res, next) {
  try {
    return success(res, await service.gradeTask(R(req), req.validated.params.submissionId, req.body || {}));
  } catch (e) {
    return next(e);
  }
}
async function upsertAssessment(req, res, next) {
  try {
    const kind = req.validated.params.kind || req.params.kind;
    return success(res, await service.upsertAssessment(R(req), req.validated.params.programId, kind, req.body || {}));
  } catch (e) {
    return next(e);
  }
}
async function getAssessment(req, res, next) {
  try {
    return success(res, await service.getAssessment(R(req), req.validated.params.assessmentId));
  } catch (e) {
    return next(e);
  }
}
async function publishAssessment(req, res, next) {
  try {
    return success(res, await service.publishAssessment(R(req), req.validated.params.assessmentId));
  } catch (e) {
    return next(e);
  }
}
async function startAssessmentAttempt(req, res, next) {
  try {
    return created(res, await service.startAssessmentAttempt(R(req), req.validated.params.assessmentId));
  } catch (e) {
    return next(e);
  }
}
async function saveAssessmentAttemptAnswers(req, res, next) {
  try {
    return success(
      res,
      await service.saveAssessmentAttemptAnswers(R(req), req.validated.params.attemptId, req.body?.answers)
    );
  } catch (e) {
    return next(e);
  }
}
async function submitAssessmentAttempt(req, res, next) {
  try {
    return success(
      res,
      await service.submitAssessmentAttempt(R(req), req.validated.params.attemptId, req.body?.answers)
    );
  } catch (e) {
    return next(e);
  }
}
async function submitAssessment(req, res, next) {
  try {
    return created(res, await service.submitAssessment(R(req), req.validated.params.assessmentId, req.body?.answers));
  } catch (e) {
    return next(e);
  }
}
async function gradeAssessmentAttempt(req, res, next) {
  try {
    return success(res, await service.gradeAssessmentAttempt(R(req), req.validated.params.attemptId, req.body || {}));
  } catch (e) {
    return next(e);
  }
}
async function listAssessmentResults(req, res, next) {
  try {
    return success(res, await service.listAssessmentResults(R(req), req.validated.params.assessmentId));
  } catch (e) {
    return next(e);
  }
}
async function getPrePostComparison(req, res, next) {
  try {
    return success(
      res,
      await service.getPrePostComparison(R(req), req.validated.params.programId, req.validated?.query || req.query || {})
    );
  } catch (e) {
    return next(e);
  }
}
async function getTraineeAssessmentStatus(req, res, next) {
  try {
    return success(res, await service.getTraineeAssessmentStatus(R(req), req.validated.params.programId));
  } catch (e) {
    return next(e);
  }
}
async function recomputeProgress(req, res, next) {
  try {
    return success(res, await service.recomputeProgress(R(req), req.validated.params.enrollmentId));
  } catch (e) {
    return next(e);
  }
}
async function getEnrollmentProgress(req, res, next) {
  try {
    return success(res, await service.getEnrollmentProgress(R(req), req.validated.params.enrollmentId));
  } catch (e) {
    return next(e);
  }
}
async function approveCompletion(req, res, next) {
  try {
    return success(res, await service.approveCompletion(R(req), req.validated.params.enrollmentId));
  } catch (e) {
    return next(e);
  }
}
async function issueCertificate(req, res, next) {
  try {
    return created(res, await service.issueCertificate(R(req), req.validated.params.enrollmentId));
  } catch (e) {
    return next(e);
  }
}
async function getEnrollmentCertificate(req, res, next) {
  try {
    return success(res, await service.getEnrollmentCertificate(R(req), req.validated.params.enrollmentId));
  } catch (e) {
    return next(e);
  }
}
async function verifyCertificate(req, res, next) {
  try {
    return success(res, await service.verifyCertificate(req.params.code));
  } catch (e) {
    return next(e);
  }
}
async function listStudentPrograms(req, res, next) {
  try {
    return success(res, await service.listStudentPrograms(R(req)));
  } catch (e) {
    return next(e);
  }
}
async function getTraineeProgramDetail(req, res, next) {
  try {
    return success(res, await service.getTraineeProgramDetail(R(req), req.validated.params.programId));
  } catch (e) {
    return next(e);
  }
}
async function listSessionAttendance(req, res, next) {
  try {
    return success(res, await service.listSessionAttendance(R(req), req.validated.params.sessionId));
  } catch (e) {
    return next(e);
  }
}
async function listProgramMaterials(req, res, next) {
  try {
    return success(res, await service.listProgramMaterials(R(req), req.validated.params.programId));
  } catch (e) {
    return next(e);
  }
}
async function createProgramMaterial(req, res, next) {
  try {
    return created(res, await service.createProgramMaterial(R(req), req.validated.params.programId, req.body || {}));
  } catch (e) {
    return next(e);
  }
}
async function publishProgram(req, res, next) {
  try {
    return success(res, await service.publishProgram(R(req), req.validated.params.programId));
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  listPrograms,
  listTrainingCourses,
  getProgram,
  createProgram,
  updateProgram,
  publishProgram,
  listCohorts,
  createCohort,
  listEnrollments,
  enrollUser,
  importPreview,
  importCommit,
  createSession,
  listCohortSessions,
  openAttendanceWindow,
  confirmAttendance,
  markAllPresent,
  listSessionAttendance,
  createTask,
  listProgramTasks,
  submitTask,
  gradeTask,
  upsertAssessment,
  listProgramAssessments,
  getAssessment,
  publishAssessment,
  startAssessmentAttempt,
  saveAssessmentAttemptAnswers,
  submitAssessmentAttempt,
  submitAssessment,
  gradeAssessmentAttempt,
  listAssessmentResults,
  getPrePostComparison,
  getTraineeAssessmentStatus,
  recomputeProgress,
  getEnrollmentProgress,
  approveCompletion,
  issueCertificate,
  getEnrollmentCertificate,
  verifyCertificate,
  listStudentPrograms,
  getTraineeProgramDetail,
  listProgramMaterials,
  createProgramMaterial,
};
