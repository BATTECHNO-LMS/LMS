const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const adminCoursesController = require('./adminCourses.controller');
const lessonTrainingController = require('./lessonTraining.controller');
const { handleCoverUpload } = require('./courses.upload');
const {
  uuidParamSchema,
  courseIdParamSchema,
  sectionIdParamSchema,
  lessonIdParamSchema,
  listAdminCoursesQuerySchema,
  createCourseBodySchema,
  updateCourseBodySchema,
  createSectionBodySchema,
  updateSectionBodySchema,
  createLessonBodySchema,
  updateLessonBodySchema,
  reorderLessonsBodySchema,
  youtubePreviewBodySchema,
  upsertLessonTrainingBodySchema,
} = require('./courses.validation');

const router = express.Router();
const superAdminOnly = authorizeRoles(env.SUPER_ADMIN_ROLE_CODE || 'super_admin');

router.get(
  '/',
  authenticate,
  superAdminOnly,
  validateRequest({ query: listAdminCoursesQuerySchema }),
  adminCoursesController.list
);

router.post(
  '/',
  authenticate,
  superAdminOnly,
  validateRequest({ body: createCourseBodySchema }),
  adminCoursesController.create
);

router.post(
  '/cover',
  authenticate,
  superAdminOnly,
  handleCoverUpload,
  adminCoursesController.uploadCover
);

router.get(
  '/:courseId/structure',
  authenticate,
  superAdminOnly,
  validateRequest({ params: courseIdParamSchema }),
  adminCoursesController.structure
);

router.post(
  '/:courseId/sections',
  authenticate,
  superAdminOnly,
  validateRequest({ params: courseIdParamSchema, body: createSectionBodySchema }),
  adminCoursesController.createSection
);

router.patch(
  '/:courseId/sections/:sectionId',
  authenticate,
  superAdminOnly,
  validateRequest({ params: sectionIdParamSchema, body: updateSectionBodySchema }),
  adminCoursesController.updateSection
);

router.delete(
  '/:courseId/sections/:sectionId',
  authenticate,
  superAdminOnly,
  validateRequest({ params: sectionIdParamSchema }),
  adminCoursesController.deleteSection
);

router.post(
  '/:courseId/sections/:sectionId/lessons',
  authenticate,
  superAdminOnly,
  validateRequest({ params: sectionIdParamSchema, body: createLessonBodySchema }),
  adminCoursesController.createLesson
);

router.patch(
  '/:courseId/lessons/:lessonId',
  authenticate,
  superAdminOnly,
  validateRequest({ params: lessonIdParamSchema, body: updateLessonBodySchema }),
  adminCoursesController.updateLesson
);

router.delete(
  '/:courseId/lessons/:lessonId',
  authenticate,
  superAdminOnly,
  validateRequest({ params: lessonIdParamSchema }),
  adminCoursesController.deleteLesson
);

router.get(
  '/:courseId/lessons/:lessonId/training',
  authenticate,
  superAdminOnly,
  validateRequest({ params: lessonIdParamSchema }),
  lessonTrainingController.getAdminConfig
);

router.put(
  '/:courseId/lessons/:lessonId/training',
  authenticate,
  superAdminOnly,
  validateRequest({ params: lessonIdParamSchema, body: upsertLessonTrainingBodySchema }),
  lessonTrainingController.upsertAdminConfig
);

router.post(
  '/:courseId/youtube-playlist/preview',
  authenticate,
  superAdminOnly,
  validateRequest({ params: courseIdParamSchema, body: youtubePreviewBodySchema }),
  adminCoursesController.previewYoutubePlaylist
);

router.post(
  '/:courseId/lessons/reorder',
  authenticate,
  superAdminOnly,
  validateRequest({ params: courseIdParamSchema, body: reorderLessonsBodySchema }),
  adminCoursesController.reorderLessons
);

router.post(
  '/:courseId/lessons/publish-drafts',
  authenticate,
  superAdminOnly,
  validateRequest({ params: courseIdParamSchema }),
  adminCoursesController.publishDraftLessons
);

router.get(
  '/:id',
  authenticate,
  superAdminOnly,
  validateRequest({ params: uuidParamSchema }),
  adminCoursesController.getById
);

router.patch(
  '/:id',
  authenticate,
  superAdminOnly,
  validateRequest({ params: uuidParamSchema, body: updateCourseBodySchema }),
  adminCoursesController.update
);

router.post(
  '/:id/publish',
  authenticate,
  superAdminOnly,
  validateRequest({ params: uuidParamSchema }),
  adminCoursesController.publish
);

router.post(
  '/:id/archive',
  authenticate,
  superAdminOnly,
  validateRequest({ params: uuidParamSchema }),
  adminCoursesController.archive
);

module.exports = router;
