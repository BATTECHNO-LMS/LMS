const coursesService = require('./courses.service');
const { success, created } = require('../../utils/apiResponse');

async function list(req, res, next) {
  try {
    const data = await coursesService.listStudentCourses(req.validated.query, req.user.userId);
    return success(res, data, { message: 'Courses retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await coursesService.getStudentCourseById(req.validated.params.id, req.user.userId);
    return success(res, data, { message: 'Course retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function start(req, res, next) {
  try {
    const data = await coursesService.startStudentCourse(req.validated.params.id, req.user.userId);
    return created(res, data, { message: 'Course started' });
  } catch (e) {
    return next(e);
  }
}

async function completeLesson(req, res, next) {
  try {
    const data = await coursesService.completeLesson(
      req.validated.params.courseId,
      req.validated.params.lessonId,
      req.user.userId
    );
    return success(res, data, { message: 'Lesson completed' });
  } catch (e) {
    return next(e);
  }
}

async function progress(req, res, next) {
  try {
    const data = await coursesService.getStudentProgress(req.validated.params.id, req.user.userId);
    return success(res, data, { message: 'Progress retrieved' });
  } catch (e) {
    return next(e);
  }
}

module.exports = { list, getById, start, completeLesson, progress };
