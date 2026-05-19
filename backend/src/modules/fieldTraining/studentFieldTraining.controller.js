const fieldTrainingService = require('./fieldTraining.service');
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

async function submitTask(req, res, next) {
  try {
    const data = await fieldTrainingService.submitTaskFile(
      req.validated.params.taskId,
      req.file,
      req.user.userId
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

module.exports = { list, myApplications, getById, apply, cancel, listTasks, submitTask };
