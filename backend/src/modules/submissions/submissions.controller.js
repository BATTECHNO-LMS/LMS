const submissionsService = require('./submissions.service');
const { success, created } = require('../../utils/apiResponse');

async function list(req, res, next) {
  try {
    const data = await submissionsService.listSubmissions(req.validated.query, req.user);
    return success(res, data, { message: 'Submissions retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await submissionsService.getSubmissionById(req.validated.params.id, req.user);
    return success(res, data, { message: 'Submission retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function listByAssessment(req, res, next) {
  try {
    const data = await submissionsService.listByAssessment(req.validated.params.id, req.user);
    return success(res, data, { message: 'Submissions retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function listByStudent(req, res, next) {
  try {
    const data = await submissionsService.listByStudent(req.validated.params.studentId, req.user);
    return success(res, data, { message: 'Submissions retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function createForAssessment(req, res, next) {
  try {
    const data = await submissionsService.createForAssessment(
      req.validated.params.id,
      req.validated.body,
      req.user
    );
    return created(res, data, { message: 'Submission created' });
  } catch (e) {
    return next(e);
  }
}

async function update(req, res, next) {
  try {
    const data = await submissionsService.updateSubmission(req.validated.params.id, req.validated.body, req.user);
    return success(res, data, { message: 'Submission updated' });
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  list,
  getById,
  listByAssessment,
  listByStudent,
  createForAssessment,
  update,
};
