const cohortsService = require('./cohorts.service');
const attendanceService = require('../attendance/attendance.service');
const { success, created } = require('../../utils/apiResponse');

async function list(req, res, next) {
  try {
    const data = await cohortsService.listCohorts(req.validated.query, req.user);
    return success(res, data, { message: 'Cohorts retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await cohortsService.getCohortById(req.validated.params.id, req.user);
    return success(res, data, { message: 'Cohort retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function create(req, res, next) {
  try {
    const data = await cohortsService.createCohort(req.validated.body, req.user);
    return created(res, data, { message: 'Cohort created' });
  } catch (e) {
    return next(e);
  }
}

async function update(req, res, next) {
  try {
    const data = await cohortsService.updateCohort(req.validated.params.id, req.validated.body, req.user);
    return success(res, data, { message: 'Cohort updated' });
  } catch (e) {
    return next(e);
  }
}

async function patchStatus(req, res, next) {
  try {
    const data = await cohortsService.patchCohortStatus(req.validated.params.id, req.validated.body, req.user);
    return success(res, data, { message: 'Cohort status updated' });
  } catch (e) {
    return next(e);
  }
}

async function attendanceSummary(req, res, next) {
  try {
    const data = await attendanceService.getCohortAttendanceSummary(req.validated.params.id, req.user);
    return success(res, data, { message: 'Attendance summary retrieved' });
  } catch (e) {
    return next(e);
  }
}

module.exports = { list, getById, create, update, patchStatus, attendanceSummary };
