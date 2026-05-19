const path = require('path');
const coursesService = require('./courses.service');
const { previewYoutube } = require('./youtubePlaylist.service');
const { resolvePublicUrl } = require('../../shared/storage/fileStorage');
const { ApiError } = require('../../utils/apiError');
const { success, created } = require('../../utils/apiResponse');

async function uploadCover(req, res, next) {
  try {
    if (!req.file) throw new ApiError(400, 'الصورة مطلوبة');
    const relative = path.posix.join('courses', 'covers', path.basename(req.file.filename));
    const url = resolvePublicUrl(relative);
    return success(res, { url, path: relative }, { message: 'Cover image uploaded' });
  } catch (e) {
    return next(e);
  }
}

async function list(req, res, next) {
  try {
    const data = await coursesService.listAdminCourses(req.validated.query);
    return success(res, data, { message: 'Courses retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await coursesService.getAdminCourseById(req.validated.params.id);
    return success(res, data, { message: 'Course retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function create(req, res, next) {
  try {
    const data = await coursesService.createAdminCourse(req.validated.body, req.user.userId);
    return created(res, data, { message: 'Course created' });
  } catch (e) {
    return next(e);
  }
}

async function update(req, res, next) {
  try {
    const data = await coursesService.updateAdminCourse(
      req.validated.params.id,
      req.validated.body,
      req.user.userId
    );
    return success(res, data, { message: 'Course updated' });
  } catch (e) {
    return next(e);
  }
}

async function publish(req, res, next) {
  try {
    const data = await coursesService.publishCourse(req.validated.params.id, req.user.userId);
    return success(res, data, { message: 'Course published' });
  } catch (e) {
    return next(e);
  }
}

async function archive(req, res, next) {
  try {
    const data = await coursesService.archiveCourse(req.validated.params.id, req.user.userId);
    return success(res, data, { message: 'Course archived' });
  } catch (e) {
    return next(e);
  }
}

async function structure(req, res, next) {
  try {
    const data = await coursesService.getCourseStructure(req.validated.params.courseId);
    return success(res, data, { message: 'Course structure retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function createSection(req, res, next) {
  try {
    const data = await coursesService.createSection(
      req.validated.params.courseId,
      req.validated.body
    );
    return created(res, data, { message: 'Section created' });
  } catch (e) {
    return next(e);
  }
}

async function updateSection(req, res, next) {
  try {
    const data = await coursesService.updateSection(
      req.validated.params.courseId,
      req.validated.params.sectionId,
      req.validated.body
    );
    return success(res, data, { message: 'Section updated' });
  } catch (e) {
    return next(e);
  }
}

async function deleteSection(req, res, next) {
  try {
    const data = await coursesService.deleteSection(
      req.validated.params.courseId,
      req.validated.params.sectionId
    );
    return success(res, data, { message: 'Section deleted' });
  } catch (e) {
    return next(e);
  }
}

async function createLesson(req, res, next) {
  try {
    const data = await coursesService.createLesson(
      req.validated.params.courseId,
      req.validated.params.sectionId,
      req.validated.body
    );
    return created(res, data, { message: 'Lesson created' });
  } catch (e) {
    return next(e);
  }
}

async function updateLesson(req, res, next) {
  try {
    const data = await coursesService.updateLesson(
      req.validated.params.courseId,
      req.validated.params.lessonId,
      req.validated.body
    );
    return success(res, data, { message: 'Lesson updated' });
  } catch (e) {
    return next(e);
  }
}

async function deleteLesson(req, res, next) {
  try {
    const data = await coursesService.deleteLesson(
      req.validated.params.courseId,
      req.validated.params.lessonId
    );
    return success(res, data, { message: 'Lesson deleted' });
  } catch (e) {
    return next(e);
  }
}

async function previewYoutubePlaylist(req, res, next) {
  try {
    const data = await previewYoutube(req.validated.body);
    return success(res, data, { message: 'YouTube preview retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function reorderLessons(req, res, next) {
  try {
    const data = await coursesService.reorderLessons(
      req.validated.params.courseId,
      req.validated.body.items
    );
    return success(res, data, { message: 'Lessons reordered' });
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  uploadCover,
  list,
  getById,
  create,
  update,
  publish,
  archive,
  structure,
  createSection,
  updateSection,
  deleteSection,
  createLesson,
  updateLesson,
  deleteLesson,
  reorderLessons,
  previewYoutubePlaylist,
};
