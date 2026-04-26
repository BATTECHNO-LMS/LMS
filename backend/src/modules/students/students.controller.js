const enrollmentsService = require('../enrollments/enrollments.service');
const sessionsService = require('../sessions/sessions.service');
const gradesService = require('../grades/grades.service');
const { success } = require('../../utils/apiResponse');

async function getMyEnrollments(req, res, next) {
  try {
    const data = await enrollmentsService.listMyEnrollments(req.user.userId);
    return success(res, data, { message: 'Enrollments retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getMySessions(req, res, next) {
  try {
    const data = await sessionsService.listMySessions(req.user.userId);
    return success(res, data, { message: 'Sessions retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getMyGrades(req, res, next) {
  try {
    const data = await gradesService.listByStudent(req.user.userId, req.user);
    return success(res, data, { message: 'Grades retrieved' });
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  getMyEnrollments,
  getMySessions,
  getMyGrades,
};
