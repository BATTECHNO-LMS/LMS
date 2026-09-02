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
async function updateSession(req, res, next) {
  try {
    return success(res, await service.updateSession(R(req), req.validated.params.sessionId, req.validated.body || {}));
  } catch (e) {
    return next(e);
  }
}
async function setAttendanceStatus(req, res, next) {
  try {
    return success(
      res,
      await service.setAttendanceStatus(R(req), req.validated.params.sessionId, req.validated.body || {})
    );
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
async function getTask(req, res, next) {
  try {
    return success(res, await service.getTaskForRequester(R(req), req.validated.params.taskId));
  } catch (e) {
    return next(e);
  }
}
async function getTaskInstructionFile(req, res, next) {
  try {
    return success(res, await service.getTaskInstructionFile(R(req), req.validated.params.taskId));
  } catch (e) {
    return next(e);
  }
}
async function downloadTaskInstructionFile(req, res, next) {
  try {
    const result = await service.openTaskInstructionFileDownload(
      R(req),
      req.validated.params.taskId
    );
    if (result.mode === 'redirect') {
      return res.redirect(302, result.url);
    }
    res.setHeader('Content-Type', result.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${String(result.fileName || 'task-instructions').replace(/"/g, '')}"`
    );
    return res.sendFile(result.absPath);
  } catch (e) {
    return next(e);
  }
}
async function listTaskSubmissions(req, res, next) {
  try {
    return success(res, await service.listTaskSubmissions(R(req), req.validated.params.taskId));
  } catch (e) {
    return next(e);
  }
}
async function resubmitTask(req, res, next) {
  try {
    return created(
      res,
      await service.resubmitTask(
        R(req),
        req.validated.params.taskId,
        req.validated.params.submissionId,
        req.body || {}
      )
    );
  } catch (e) {
    return next(e);
  }
}
async function requestTaskRevision(req, res, next) {
  try {
    return success(res, await service.requestTaskRevision(R(req), req.validated.params.submissionId, req.body || {}));
  } catch (e) {
    return next(e);
  }
}
async function reopenTaskSubmission(req, res, next) {
  try {
    return success(res, await service.reopenTaskSubmission(R(req), req.validated.params.submissionId, req.body || {}));
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
    return success(
      res,
      await service.getTraineeProgramDetail(R(req), req.validated.params.programId, {
        sections: req.validated?.query?.sections,
      })
    );
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
    return created(
      res,
      await service.createProgramMaterial(
        R(req),
        req.validated.params.programId,
        req.validated.body || req.body || {}
      )
    );
  } catch (e) {
    return next(e);
  }
}
async function updateProgramMaterial(req, res, next) {
  try {
    return success(
      res,
      await service.updateProgramMaterial(
        R(req),
        req.validated.params.materialId,
        req.validated.body || req.body || {}
      )
    );
  } catch (e) {
    return next(e);
  }
}
async function deleteProgramMaterial(req, res, next) {
  try {
    return success(res, await service.deleteProgramMaterial(R(req), req.validated.params.materialId));
  } catch (e) {
    return next(e);
  }
}
async function listRecordedLectures(req, res, next) {
  try {
    return success(res, await service.listRecordedLectures(R(req), req.validated.params.programId));
  } catch (e) {
    return next(e);
  }
}
async function createRecordedLecture(req, res, next) {
  try {
    return created(
      res,
      await service.createRecordedLecture(
        R(req),
        req.validated.params.programId,
        req.validated.body || req.body || {}
      )
    );
  } catch (e) {
    return next(e);
  }
}
async function updateRecordedLecture(req, res, next) {
  try {
    return success(
      res,
      await service.updateRecordedLecture(
        R(req),
        req.validated.params.lectureId,
        req.validated.body || req.body || {}
      )
    );
  } catch (e) {
    return next(e);
  }
}
async function publishRecordedLecture(req, res, next) {
  try {
    return success(
      res,
      await service.publishRecordedLecture(
        R(req),
        req.validated.params.lectureId,
        req.validated.body || req.body || {}
      )
    );
  } catch (e) {
    return next(e);
  }
}
async function deleteRecordedLecture(req, res, next) {
  try {
    return success(res, await service.deleteRecordedLecture(R(req), req.validated.params.lectureId));
  } catch (e) {
    return next(e);
  }
}
async function getMaterialPlaybackUrl(req, res, next) {
  try {
    return success(res, await service.getMaterialPlaybackUrl(R(req), req.validated.params.materialId));
  } catch (e) {
    return next(e);
  }
}
async function updateTask(req, res, next) {
  try {
    return success(
      res,
      await service.updateTask(R(req), req.validated.params.taskId, req.validated.body || req.body || {})
    );
  } catch (e) {
    return next(e);
  }
}
async function listProgramTasksDetailed(req, res, next) {
  try {
    return success(res, await service.listProgramTasksDetailed(R(req), req.validated.params.programId));
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

async function getProgramEvaluation(req, res, next) {
  try {
    return success(res, await service.getProgramEvaluation(R(req), req.validated.params.programId));
  } catch (e) {
    return next(e);
  }
}
async function getEnrollmentEvaluation(req, res, next) {
  try {
    return success(res, await service.getEnrollmentEvaluation(R(req), req.validated.params.enrollmentId));
  } catch (e) {
    return next(e);
  }
}
async function saveEvaluationDraft(req, res, next) {
  try {
    return success(
      res,
      await service.saveEvaluationDraft(R(req), req.validated.params.responseId, req.validated?.body?.answers)
    );
  } catch (e) {
    return next(e);
  }
}
async function submitEvaluation(req, res, next) {
  try {
    return success(
      res,
      await service.submitEvaluation(R(req), req.validated.params.responseId, req.validated?.body?.answers)
    );
  } catch (e) {
    return next(e);
  }
}
async function reopenEvaluation(req, res, next) {
  try {
    return success(
      res,
      await service.reopenEvaluation(R(req), req.validated.params.assignmentId, req.validated.body.reason)
    );
  } catch (e) {
    return next(e);
  }
}
async function getProgramCompletionReadiness(req, res, next) {
  try {
    return success(
      res,
      await service.getProgramCompletionReadiness(R(req), req.validated.params.programId, req.validated?.query || {})
    );
  } catch (e) {
    return next(e);
  }
}
async function finalizeTraining(req, res, next) {
  try {
    const body = req.validated?.body || {};
    return success(
      res,
      await service.finalizeTraining(R(req), { programId: req.validated.params.programId, ...body })
    );
  } catch (e) {
    return next(e);
  }
}
async function reopenTraining(req, res, next) {
  try {
    return success(
      res,
      await service.reopenTraining(R(req), req.validated.params.programId, req.validated?.body || {})
    );
  } catch (e) {
    return next(e);
  }
}
async function getIndividualReport(req, res, next) {
  try {
    return success(res, await service.getIndividualReport(R(req), req.validated.params.enrollmentId));
  } catch (e) {
    return next(e);
  }
}
async function generateIndividualReport(req, res, next) {
  try {
    return created(res, await service.generateIndividualReport(R(req), req.validated.params.enrollmentId));
  } catch (e) {
    return next(e);
  }
}
async function getCourseReport(req, res, next) {
  try {
    return success(
      res,
      await service.getCourseReport(R(req), req.validated.params.programId, req.validated?.query || {})
    );
  } catch (e) {
    return next(e);
  }
}
async function generateCourseReport(req, res, next) {
  try {
    return created(
      res,
      await service.generateCourseReport(R(req), req.validated.params.programId, req.validated?.query || {})
    );
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
  updateSession,
  setAttendanceStatus,
  listCohortSessions,
  openAttendanceWindow,
  confirmAttendance,
  markAllPresent,
  listSessionAttendance,
  createTask,
  listProgramTasks,
  submitTask,
  getTask,
  getTaskInstructionFile,
  downloadTaskInstructionFile,
  listTaskSubmissions,
  resubmitTask,
  requestTaskRevision,
  reopenTaskSubmission,
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
  updateProgramMaterial,
  deleteProgramMaterial,
  listRecordedLectures,
  createRecordedLecture,
  updateRecordedLecture,
  publishRecordedLecture,
  deleteRecordedLecture,
  getMaterialPlaybackUrl,
  updateTask,
  listProgramTasksDetailed,
  getProgramEvaluation,
  getEnrollmentEvaluation,
  saveEvaluationDraft,
  submitEvaluation,
  reopenEvaluation,
  getProgramCompletionReadiness,
  finalizeTraining,
  reopenTraining,
  getIndividualReport,
  generateIndividualReport,
  getCourseReport,
  generateCourseReport,
};
