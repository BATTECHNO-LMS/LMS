const studentService = require('./student.service');
const enrollmentsService = require('../enrollments/enrollments.service');
const { success, created } = require('../../utils/apiResponse');

async function availableCohorts(req, res, next) {
  try {
    const data = await studentService.availableCohorts(req.user);
    return success(res, data, { message: 'Cohorts retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function createEnrollmentRequest(req, res, next) {
  try {
    const data = await enrollmentsService.requestEnrollment(req.validated.body, req.user);
    return created(res, data, { message: 'Enrollment request submitted' });
  } catch (e) {
    return next(e);
  }
}

async function semesterSchedule(req, res, next) {
  try {
    const data = await studentService.semesterSchedule(req.user);
    return success(res, data, { message: 'Schedule retrieved' });
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  availableCohorts,
  createEnrollmentRequest,
  semesterSchedule,
};
