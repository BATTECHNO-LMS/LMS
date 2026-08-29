const workflowService = require('./fieldTraining.workflowService');
const { success, created } = require('../../utils/apiResponse');

async function startTraining(req, res, next) {
  try {
    const data = await workflowService.startTraining(
      req.validated.params.id,
      req.user.userId,
      req.user
    );
    return success(res, data, { message: 'Training started' });
  } catch (e) {
    return next(e);
  }
}

async function listSessions(req, res, next) {
  try {
    const data = await workflowService.listSessions(req.validated.params.id, req.user);
    return success(res, data, { message: 'Sessions retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function createSession(req, res, next) {
  try {
    const data = await workflowService.createSession(
      req.validated.params.id,
      req.validated.body,
      req.user.userId,
      req.user
    );
    return created(res, data, { message: 'Session created' });
  } catch (e) {
    return next(e);
  }
}

async function updateSession(req, res, next) {
  try {
    const data = await workflowService.updateSession(
      req.validated.params.sessionId,
      req.validated.body,
      req.user
    );
    return success(res, data, { message: 'Session updated' });
  } catch (e) {
    return next(e);
  }
}

async function deleteSession(req, res, next) {
  try {
    const data = await workflowService.deleteSession(req.validated.params.sessionId, req.user);
    return success(res, data, { message: 'Session deleted' });
  } catch (e) {
    return next(e);
  }
}

async function saveAttendance(req, res, next) {
  try {
    const data = await workflowService.saveSessionAttendance(
      req.validated.params.sessionId,
      req.validated.body.records,
      req.user.userId,
      req.user
    );
    return success(res, data, { message: 'Attendance saved' });
  } catch (e) {
    return next(e);
  }
}

async function listSessionParticipants(req, res, next) {
  try {
    const data = await workflowService.getSessionParticipants(
      req.validated.params.sessionId,
      req.user
    );
    return success(res, data, { message: 'Participants retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function upsertAssessment(req, res, next) {
  try {
    const data = await workflowService.upsertAssessment(
      req.validated.params.id,
      req.validated.params.type,
      req.validated.body,
      req.user.userId,
      req.user
    );
    return success(res, data, { message: 'Assessment saved' });
  } catch (e) {
    return next(e);
  }
}

async function publishAssessment(req, res, next) {
  try {
    const data = await workflowService.publishAssessment(
      req.validated.params.id,
      req.validated.params.type,
      req.user.userId,
      req.user
    );
    return success(res, data, { message: 'Assessment published' });
  } catch (e) {
    return next(e);
  }
}

async function expelParticipant(req, res, next) {
  try {
    const data = await workflowService.expelParticipant(
      req.validated.params.applicationId,
      req.validated.body,
      req.user.userId,
      req.user
    );
    return success(res, data, { message: 'Participant expelled' });
  } catch (e) {
    return next(e);
  }
}

async function requestExpulsion(req, res, next) {
  try {
    const data = await workflowService.requestExpulsion(
      req.validated.params.applicationId,
      req.validated.body,
      req.user.userId,
      req.user
    );
    return success(res, data, { message: data.message || 'Expulsion request submitted' });
  } catch (e) {
    return next(e);
  }
}

async function issueCompletionLetter(req, res, next) {
  try {
    const data = await workflowService.issueCompletionLetter(
      req.validated.params.applicationId,
      req.user.userId,
      req.user
    );
    return created(res, data, { message: 'Completion letter issued' });
  } catch (e) {
    return next(e);
  }
}

function sendCompletionLetterPdf(res, file, inline = false) {
  const letterMod = require('./fieldTraining.completionLetter');
  const buffer = file.buffer;
  const filename = file.filename || 'كتاب_إنهاء_التدريب.pdf';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', letterMod.buildContentDisposition(filename, inline || file.inline));
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Completion-Letter-Identity', String(file.identity || ''));
  return res.send(buffer);
}

async function previewCompletionLetterAsManager(req, res, next) {
  try {
    const file = await workflowService.previewCompletionLetterAsManager(
      req.validated.params.applicationId,
      req.user
    );
    return sendCompletionLetterPdf(res, file, true);
  } catch (e) {
    return next(e);
  }
}

async function previewCompletionLetterAsAcademic(req, res, next) {
  try {
    const file = await workflowService.previewCompletionLetterAsAcademic(
      req.validated.params.applicationId,
      req.user
    );
    return sendCompletionLetterPdf(res, file, true);
  } catch (e) {
    return next(e);
  }
}

async function downloadCompletionLetter(req, res, next) {
  try {
    const file = await workflowService.downloadCompletionLetter(
      req.validated.params.applicationId,
      req.user.userId
    );
    return sendCompletionLetterPdf(res, file, false);
  } catch (e) {
    return next(e);
  }
}

async function previewOwnCompletionLetter(req, res, next) {
  try {
    const file = await workflowService.downloadCompletionLetter(
      req.validated.params.applicationId,
      req.user.userId
    );
    return sendCompletionLetterPdf(res, file, true);
  } catch (e) {
    return next(e);
  }
}

async function downloadCompletionLetterAsManager(req, res, next) {
  try {
    const file = await workflowService.downloadCompletionLetterAsManager(
      req.validated.params.applicationId,
      req.user
    );
    return sendCompletionLetterPdf(res, file, false);
  } catch (e) {
    return next(e);
  }
}

async function downloadCompletionLetterAsAcademic(req, res, next) {
  try {
    const file = await workflowService.downloadCompletionLetterAsAcademic(
      req.validated.params.applicationId,
      req.user
    );
    return sendCompletionLetterPdf(res, file, false);
  } catch (e) {
    return next(e);
  }
}

async function listInstructors(req, res, next) {
  try {
    const data = await workflowService.listInstructors();
    return success(res, data, { message: 'Instructors retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getApplicationProgress(req, res, next) {
  try {
    const data = await workflowService.getApplicationProgress(
      req.validated.params.applicationId,
      req.user
    );
    return success(res, data, { message: 'Progress retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getApplicationHours(req, res, next) {
  try {
    const data = await workflowService.getApplicationHours(
      req.validated.params.applicationId,
      req.user
    );
    return success(res, data, { message: 'Hours retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function updateApplicationHours(req, res, next) {
  try {
    const data = await workflowService.updateApplicationHours(
      req.validated.params.applicationId,
      req.validated.body,
      req.user
    );
    return success(res, data, { message: 'Hours updated' });
  } catch (e) {
    return next(e);
  }
}

async function recalculateEligibility(req, res, next) {
  try {
    const data = await workflowService.recalculateEligibility(
      req.validated.params.applicationId,
      req.user
    );
    return success(res, data, { message: 'Eligibility recalculated' });
  } catch (e) {
    return next(e);
  }
}

async function gradeAssessmentAttempt(req, res, next) {
  try {
    const data = await workflowService.gradeAssessmentAttempt(
      req.validated.params.attemptId,
      req.validated.body,
      req.user
    );
    return success(res, data, { message: 'Attempt graded' });
  } catch (e) {
    return next(e);
  }
}

async function getSessionAttendance(req, res, next) {
  try {
    const data = await workflowService.getSessionAttendance(
      req.validated.params.sessionId,
      req.user
    );
    return success(res, data, { message: 'Attendance retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function listOpportunityAssessments(req, res, next) {
  try {
    const data = await workflowService.listOpportunityAssessments(
      req.validated.params.id,
      req.user
    );
    return success(res, data, { message: 'Assessments retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function createOpportunityAssessment(req, res, next) {
  try {
    const data = await workflowService.createOpportunityAssessment(
      req.validated.params.id,
      req.validated.body,
      req.user.userId,
      req.user
    );
    return created(res, data, { message: 'Assessment created' });
  } catch (e) {
    return next(e);
  }
}

async function updateAssessment(req, res, next) {
  try {
    const data = await workflowService.updateAssessmentById(
      req.validated.params.assessmentId,
      req.validated.body,
      req.user
    );
    return success(res, data, { message: 'Assessment updated' });
  } catch (e) {
    return next(e);
  }
}

async function publishAssessmentById(req, res, next) {
  try {
    const data = await workflowService.publishAssessmentById(
      req.validated.params.assessmentId,
      req.user.userId,
      req.user
    );
    return success(res, data, { message: 'Assessment published' });
  } catch (e) {
    return next(e);
  }
}

async function getStudentProgress(req, res, next) {
  try {
    const data = await workflowService.getStudentOpportunityProgress(
      req.validated.params.id,
      req.user.userId
    );
    return success(res, data, { message: 'Progress retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function listStudentAssessments(req, res, next) {
  try {
    const data = await workflowService.listStudentAssessments(
      req.validated.params.id,
      req.user.userId
    );
    return success(res, data, { message: 'Assessments retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function submitAssessmentById(req, res, next) {
  try {
    const data = await workflowService.submitAssessmentById(
      req.validated.params.assessmentId,
      req.validated.body.answers,
      req.user.userId
    );
    return success(res, data, { message: 'Assessment submitted' });
  } catch (e) {
    return next(e);
  }
}

function requestMeta(req) {
  return {
    ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
    deviceInfo: String(req.headers['user-agent'] || '').slice(0, 500) || null,
  };
}

async function openAttendanceWindow(req, res, next) {
  try {
    const attendanceWindow = require('./fieldTraining.attendanceWindow.service');
    const data = await attendanceWindow.openAttendanceWindow(
      req.validated.params.sessionId,
      req.validated.body,
      req.user
    );
    return success(res, data, { message: 'Attendance window opened' });
  } catch (e) {
    return next(e);
  }
}

async function getAttendanceWindow(req, res, next) {
  try {
    const attendanceWindow = require('./fieldTraining.attendanceWindow.service');
    const data = await attendanceWindow.getSessionAttendanceWindow(
      req.validated.params.sessionId,
      req.user
    );
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function closeAttendanceWindow(req, res, next) {
  try {
    const attendanceWindow = require('./fieldTraining.attendanceWindow.service');
    const data = await attendanceWindow.closeAttendanceWindow(
      req.validated.params.sessionId,
      req.user
    );
    return success(res, data, { message: 'Attendance window closed' });
  } catch (e) {
    return next(e);
  }
}

async function finalizeAttendanceAbsences(req, res, next) {
  try {
    const attendanceWindow = require('./fieldTraining.attendanceWindow.service');
    const data = await attendanceWindow.finalizeUnconfirmedAbsences(
      req.validated.params.sessionId,
      req.user
    );
    return success(res, data, { message: 'Unconfirmed absences finalized' });
  } catch (e) {
    return next(e);
  }
}

async function markAllPresent(req, res, next) {
  try {
    const attendanceWindow = require('./fieldTraining.attendanceWindow.service');
    const data = await attendanceWindow.markAllPresent(
      req.validated.params.sessionId,
      req.validated.body,
      req.user,
      requestMeta(req)
    );
    return success(res, data, { message: data.message || 'تم تسجيل جميع الطلاب المؤهلين كحاضرين' });
  } catch (e) {
    return next(e);
  }
}

async function patchStudentAttendance(req, res, next) {
  try {
    const attendanceWindow = require('./fieldTraining.attendanceWindow.service');
    const data = await attendanceWindow.updateStudentAttendanceManual(
      req.validated.params.sessionId,
      req.validated.params.studentId,
      req.validated.body,
      req.user,
      requestMeta(req)
    );
    return success(res, data, { message: 'Attendance updated' });
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  startTraining,
  listSessions,
  createSession,
  updateSession,
  deleteSession,
  saveAttendance,
  listSessionParticipants,
  getSessionAttendance,
  openAttendanceWindow,
  getAttendanceWindow,
  closeAttendanceWindow,
  finalizeAttendanceAbsences,
  markAllPresent,
  patchStudentAttendance,
  upsertAssessment,
  publishAssessment,
  listOpportunityAssessments,
  createOpportunityAssessment,
  updateAssessment,
  publishAssessmentById,
  getApplicationProgress,
  getApplicationHours,
  updateApplicationHours,
  recalculateEligibility,
  gradeAssessmentAttempt,
  getStudentProgress,
  listStudentAssessments,
  submitAssessmentById,
  downloadCompletionLetter,
  previewOwnCompletionLetter,
  expelParticipant,
  requestExpulsion,
  issueCompletionLetter,
  previewCompletionLetterAsManager,
  previewCompletionLetterAsAcademic,
  downloadCompletionLetterAsManager,
  downloadCompletionLetterAsAcademic,
  listInstructors,
};
