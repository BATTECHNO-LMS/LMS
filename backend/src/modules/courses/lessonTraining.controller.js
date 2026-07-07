const lessonTrainingService = require('./lessonTraining.service');
const { ApiError } = require('../../utils/apiError');
const { success, created } = require('../../utils/apiResponse');

async function getState(req, res, next) {
  try {
    const { courseId, lessonId } = req.validated.params;
    const data = await lessonTrainingService.getStudentTrainingState(
      courseId,
      lessonId,
      req.user.userId
    );
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function start(req, res, next) {
  try {
    const { courseId, lessonId } = req.validated.params;
    const data = await lessonTrainingService.startTraining(
      courseId,
      lessonId,
      req.user.userId
    );
    return created(res, data);
  } catch (e) {
    return next(e);
  }
}

async function uploadSubmission(req, res, next) {
  try {
    const { courseId, lessonId } = req.validated.params;
    const data = await lessonTrainingService.submitFile(
      courseId,
      lessonId,
      req.user.userId,
      req.file,
      req.body || {},
      req.user
    );
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function submitAnswers(req, res, next) {
  try {
    const { courseId, lessonId } = req.validated.params;
    const data = await lessonTrainingService.submitAnswers(
      courseId,
      lessonId,
      req.user.userId,
      req.validated.body.answers
    );
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function getAdminConfig(req, res, next) {
  try {
    const { courseId, lessonId } = req.validated.params;
    const data = await lessonTrainingService.getAdminTraining(courseId, lessonId);
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

async function upsertAdminConfig(req, res, next) {
  try {
    const { courseId, lessonId } = req.validated.params;
    const data = await lessonTrainingService.upsertAdminTraining(
      courseId,
      lessonId,
      req.validated.body
    );
    return success(res, data);
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  getState,
  start,
  uploadSubmission,
  submitAnswers,
  getAdminConfig,
  upsertAdminConfig,
};
