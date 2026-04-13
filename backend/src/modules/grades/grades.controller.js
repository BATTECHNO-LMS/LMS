const gradesService = require('./grades.service');
const { success, created } = require('../../utils/apiResponse');

async function list(req, res, next) {
  try {
    const data = await gradesService.listGrades(req.validated.query, req.user);
    return success(res, data, { message: 'Grades retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await gradesService.getGradeById(req.validated.params.id, req.user);
    return success(res, data, { message: 'Grade retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function listByAssessment(req, res, next) {
  try {
    const data = await gradesService.listByAssessment(req.validated.params.id, req.user);
    return success(res, data, { message: 'Grades retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function listByStudent(req, res, next) {
  try {
    const data = await gradesService.listByStudent(req.validated.params.studentId, req.user);
    return success(res, data, { message: 'Grades retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function createForAssessment(req, res, next) {
  try {
    const data = await gradesService.createGradeForAssessment(
      req.validated.params.id,
      req.validated.body,
      req.user
    );
    return created(res, data, { message: 'Grade created' });
  } catch (e) {
    return next(e);
  }
}

async function update(req, res, next) {
  try {
    const data = await gradesService.updateGrade(req.validated.params.id, req.validated.body, req.user);
    return success(res, data, { message: 'Grade updated' });
  } catch (e) {
    return next(e);
  }
}

async function finalize(req, res, next) {
  try {
    const data = await gradesService.finalizeGrade(req.validated.params.id, req.user);
    return success(res, data, { message: 'Grade finalized' });
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
  finalize,
};
