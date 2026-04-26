const enrollmentsService = require('./enrollments.service');
const { success, created } = require('../../utils/apiResponse');

async function listByCohort(req, res, next) {
  try {
    const data = await enrollmentsService.listByCohort(req.validated.params.id, req.user);
    return success(res, data, { message: 'Enrollments retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function createForCohort(req, res, next) {
  try {
    const data = await enrollmentsService.createForCohort(req.validated.params.id, req.validated.body, req.user);
    return created(res, data, { message: 'Enrollment created' });
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await enrollmentsService.getById(req.validated.params.id, req.user);
    return success(res, data, { message: 'Enrollment retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function patchStatus(req, res, next) {
  try {
    const data = await enrollmentsService.patchStatus(req.validated.params.id, req.validated.body, req.user);
    return success(res, data, { message: 'Enrollment updated' });
  } catch (e) {
    return next(e);
  }
}

async function listMine(req, res, next) {
  try {
    const data = await enrollmentsService.listMine(req.user);
    return success(res, data, { message: 'Enrollments retrieved' });
  } catch (e) {
    return next(e);
  }
}

module.exports = { listByCohort, createForCohort, getById, patchStatus, listMine };
