const sessionsService = require('./sessions.service');
const attendanceService = require('../attendance/attendance.service');
const { success, created } = require('../../utils/apiResponse');

async function listByCohort(req, res, next) {
  try {
    const data = await sessionsService.listByCohort(req.validated.params.id, req.user);
    return success(res, data, { message: 'Sessions retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function createForCohort(req, res, next) {
  try {
    const data = await sessionsService.createForCohort(req.validated.params.id, req.validated.body, req.user);
    return created(res, data, { message: 'Session created' });
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await sessionsService.getById(req.validated.params.id, req.user);
    return success(res, data, { message: 'Session retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function update(req, res, next) {
  try {
    const data = await sessionsService.update(req.validated.params.id, req.validated.body, req.user);
    return success(res, data, { message: 'Session updated' });
  } catch (e) {
    return next(e);
  }
}

async function patchDocumentation(req, res, next) {
  try {
    const data = await sessionsService.patchDocumentation(req.validated.params.id, req.validated.body, req.user);
    return success(res, data, { message: 'Session documentation updated' });
  } catch (e) {
    return next(e);
  }
}

async function getAttendance(req, res, next) {
  try {
    const data = await attendanceService.getSessionAttendance(req.validated.params.id, req.user);
    return success(res, data, { message: 'Attendance retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function saveAttendance(req, res, next) {
  try {
    const data = await attendanceService.saveSessionAttendance(
      req.validated.params.id,
      req.validated.body,
      req.user
    );
    return success(res, data, { message: 'Attendance saved' });
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  listByCohort,
  createForCohort,
  getById,
  update,
  patchDocumentation,
  getAttendance,
  saveAttendance,
};
