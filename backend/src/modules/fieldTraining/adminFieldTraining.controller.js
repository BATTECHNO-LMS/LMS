const fieldTrainingService = require('./fieldTraining.service');
const { success, created } = require('../../utils/apiResponse');
const fs = require('fs');

async function list(req, res, next) {
  try {
    const data = await fieldTrainingService.listAdminOpportunities(req.validated.query, req.user);
    return success(res, data, { message: 'Field training opportunities retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function stats(req, res, next) {
  try {
    const data = await fieldTrainingService.getAdminStats(req.validated.query, req.user);
    return success(res, data, { message: 'Field training stats retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await fieldTrainingService.getAdminOpportunityById(req.validated.params.id, req.user);
    return success(res, data, { message: 'Opportunity retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function create(req, res, next) {
  try {
    const data = await fieldTrainingService.createAdminOpportunity(
      req.validated.body,
      req.user.userId,
      req.user
    );
    return created(res, data, { message: 'Opportunity created' });
  } catch (e) {
    return next(e);
  }
}

async function update(req, res, next) {
  try {
    const data = await fieldTrainingService.updateAdminOpportunity(
      req.validated.params.id,
      req.validated.body,
      req.user.userId,
      req.user
    );
    return success(res, data, { message: 'Opportunity updated' });
  } catch (e) {
    return next(e);
  }
}

async function publish(req, res, next) {
  try {
    const data = await fieldTrainingService.publishOpportunity(
      req.validated.params.id,
      req.user.userId,
      req.user
    );
    return success(res, data, { message: 'Opportunity published' });
  } catch (e) {
    return next(e);
  }
}

async function archive(req, res, next) {
  try {
    const data = await fieldTrainingService.archiveOpportunity(
      req.validated.params.id,
      req.user.userId,
      req.user
    );
    return success(res, data, { message: 'Opportunity archived' });
  } catch (e) {
    return next(e);
  }
}

async function listApplications(req, res, next) {
  try {
    const data = await fieldTrainingService.listOpportunityApplications(
      req.validated.params.id,
      req.user
    );
    return success(res, data, { message: 'Applications retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function reviewApplication(req, res, next) {
  try {
    const data = await fieldTrainingService.reviewApplication(
      req.validated.params.applicationId,
      req.validated.body,
      req.user.userId,
      req.user
    );
    return success(res, data, { message: 'Application updated' });
  } catch (e) {
    return next(e);
  }
}

async function listTasks(req, res, next) {
  try {
    const data = await fieldTrainingService.listOpportunityTasks(req.validated.params.id, {
      user: req.user,
    });
    return success(res, data, { message: 'Tasks retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function createTask(req, res, next) {
  try {
    const data = await fieldTrainingService.createOpportunityTask(
      req.validated.params.id,
      req.validated.body,
      req.user
    );
    return created(res, data, { message: 'Task created' });
  } catch (e) {
    return next(e);
  }
}

async function updateTask(req, res, next) {
  try {
    const data = await fieldTrainingService.updateOpportunityTask(
      req.validated.params.taskId,
      req.validated.body,
      req.user
    );
    return success(res, data, { message: 'Task updated' });
  } catch (e) {
    return next(e);
  }
}

async function deleteTask(req, res, next) {
  try {
    const data = await fieldTrainingService.deleteOpportunityTask(req.validated.params.taskId, req.user);
    return success(res, data, { message: 'Task deleted' });
  } catch (e) {
    return next(e);
  }
}

async function listSubmissions(req, res, next) {
  try {
    const data = await fieldTrainingService.listOpportunitySubmissions(req.validated.params.id, req.user);
    return success(res, data, { message: 'Submissions retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function downloadSubmission(req, res, next) {
  try {
    const { absPath, fileName, mimeType } = await fieldTrainingService.downloadSubmissionFile(
      req.validated.params.submissionId,
      req.user,
      { asAdmin: true }
    );
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    const stream = fs.createReadStream(absPath);
    stream.on('error', (err) => next(err));
    stream.pipe(res);
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  list,
  stats,
  getById,
  create,
  update,
  publish,
  archive,
  listApplications,
  reviewApplication,
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  listSubmissions,
  downloadSubmission,
};
