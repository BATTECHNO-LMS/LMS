const assessmentsService = require('./assessments.service');
const { success, created } = require('../../utils/apiResponse');

async function list(req, res, next) {
  try {
    const data = await assessmentsService.listAssessments(req.validated.query, req.user);
    return success(res, data, { message: 'Assessments retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await assessmentsService.getAssessmentById(req.validated.params.id, req.user);
    return success(res, data, { message: 'Assessment retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function create(req, res, next) {
  try {
    const data = await assessmentsService.createAssessment(req.validated.body, req.user);
    return created(res, data, { message: 'Assessment created' });
  } catch (e) {
    return next(e);
  }
}

async function update(req, res, next) {
  try {
    const data = await assessmentsService.updateAssessment(req.validated.params.id, req.validated.body, req.user);
    return success(res, data, { message: 'Assessment updated' });
  } catch (e) {
    return next(e);
  }
}

async function patchStatus(req, res, next) {
  try {
    const data = await assessmentsService.patchAssessmentStatus(
      req.validated.params.id,
      req.validated.body,
      req.user
    );
    return success(res, data, { message: 'Assessment status updated' });
  } catch (e) {
    return next(e);
  }
}

module.exports = { list, getById, create, update, patchStatus };
