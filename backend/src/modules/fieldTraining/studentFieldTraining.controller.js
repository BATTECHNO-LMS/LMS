const fieldTrainingService = require('./fieldTraining.service');
const workflowService = require('./fieldTraining.workflowService');
const { ApiError } = require('../../utils/apiError');
const { success, created } = require('../../utils/apiResponse');

async function list(req, res, next) {
  try {
    const data = await fieldTrainingService.listStudentOpportunities(
      req.validated.query,
      req.user.userId
    );
    return success(res, data, { message: 'Opportunities retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function myApplications(req, res, next) {
  try {
    const data = await fieldTrainingService.listMyApplications(req.user.userId);
    return success(res, data, { message: 'Applications retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await fieldTrainingService.getStudentOpportunityById(
      req.validated.params.id,
      req.user.userId
    );
    return success(res, data, { message: 'Opportunity retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function apply(req, res, next) {
  try {
    const data = await fieldTrainingService.applyToOpportunity(
      req.validated.params.id,
      req.validated.body,
      req.user.userId
    );
    return created(res, data, { message: 'Application submitted' });
  } catch (e) {
    return next(e);
  }
}

async function cancel(req, res, next) {
  try {
    const data = await fieldTrainingService.cancelApplication(
      req.validated.params.applicationId,
      req.user.userId
    );
    return success(res, data, { message: 'Application cancelled' });
  } catch (e) {
    return next(e);
  }
}

async function listTasks(req, res, next) {
  try {
    const data = await fieldTrainingService.listStudentOpportunityTasks(
      req.validated.params.id,
      req.user.userId
    );
    return success(res, data, { message: 'Tasks retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function listSessions(req, res, next) {
  try {
    const data = await workflowService.listSessions(req.validated.params.id, null, {
      studentId: req.user.userId,
    });
    return success(res, data, { message: 'Sessions retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getAssessment(req, res, next) {
  try {
    const data = await workflowService.getStudentAssessment(
      req.validated.params.id,
      req.validated.params.type,
      req.user.userId
    );
    return success(res, data, { message: 'Assessment retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function submitAssessment(req, res, next) {
  try {
    const data = await workflowService.submitAssessment(
      req.validated.params.id,
      req.validated.params.type,
      req.validated.body.answers,
      req.user.userId
    );
    return success(res, data, { message: 'Assessment submitted' });
  } catch (e) {
    return next(e);
  }
}

async function aiSelfEvaluate(req, res, next) {
  try {
    const data = await workflowService.runTaskAiSelfEvaluate(
      req.validated.params.taskId,
      req.validated.body.studentInput,
      req.user.userId
    );
    return success(res, data, { message: 'AI evaluation complete' });
  } catch (e) {
    if (e.code === 'AI_NOT_CONFIGURED') {
      return next(new ApiError(503, e.message, null, 'AI_NOT_CONFIGURED'));
    }
    return next(e);
  }
}

async function submitTask(req, res, next) {
  try {
    const body = req.body || {};
    const data = await fieldTrainingService.submitTaskFile(
      req.validated.params.taskId,
      req.file,
      req.user.userId,
      body,
      req.user
    );
    return success(res, data, { message: 'Task submitted' });
  } catch (e) {
    if (e.message === 'FILE_TOO_LARGE') {
      return next(new ApiError(400, 'حجم الملف يتجاوز 8 ميجابايت'));
    }
    if (e.message === 'UNSUPPORTED_FILE_TYPE') {
      return next(new ApiError(400, 'نوع الملف غير مدعوم. استخدم صورة أو PDF'));
    }
    return next(e);
  }
}

async function downloadSubmission(req, res, next) {
  const fs = require('fs');
  try {
    const result = await fieldTrainingService.downloadSubmissionFile(
      req.validated.params.submissionId,
      req.user,
      { asAdmin: false }
    );
    if (result.redirectUrl) {
      return res.redirect(result.redirectUrl);
    }
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.fileName)}"`);
    const stream = fs.createReadStream(result.absPath);
    stream.on('error', (err) => next(err));
    stream.pipe(res);
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  list,
  myApplications,
  getById,
  apply,
  cancel,
  listTasks,
  listSessions,
  getAssessment,
  submitAssessment,
  aiSelfEvaluate,
  submitTask,
  downloadSubmission,
};
