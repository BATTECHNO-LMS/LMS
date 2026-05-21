const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const studentCoursesController = require('./studentCourses.controller');
const lessonTrainingController = require('./lessonTraining.controller');
const { handleLessonSubmissionUpload } = require('./lessonTraining.upload');
const {
  uuidParamSchema,
  lessonIdParamSchema,
  listStudentCoursesQuerySchema,
  submitLessonAnswersBodySchema,
} = require('./courses.validation');

const router = express.Router();
const studentOnly = authorizeRoles(env.STUDENT_ROLE_CODE);

router.get(
  '/',
  authenticate,
  studentOnly,
  validateRequest({ query: listStudentCoursesQuerySchema }),
  studentCoursesController.list
);

router.post(
  '/:courseId/lessons/:lessonId/complete',
  authenticate,
  studentOnly,
  validateRequest({ params: lessonIdParamSchema }),
  studentCoursesController.completeLesson
);

router.get(
  '/:courseId/lessons/:lessonId/training',
  authenticate,
  studentOnly,
  validateRequest({ params: lessonIdParamSchema }),
  lessonTrainingController.getState
);

router.post(
  '/:courseId/lessons/:lessonId/training/start',
  authenticate,
  studentOnly,
  validateRequest({ params: lessonIdParamSchema }),
  lessonTrainingController.start
);

router.post(
  '/:courseId/lessons/:lessonId/training/submission',
  authenticate,
  studentOnly,
  validateRequest({ params: lessonIdParamSchema }),
  handleLessonSubmissionUpload,
  lessonTrainingController.uploadSubmission
);

router.post(
  '/:courseId/lessons/:lessonId/training/answers',
  authenticate,
  studentOnly,
  validateRequest({ params: lessonIdParamSchema, body: submitLessonAnswersBodySchema }),
  lessonTrainingController.submitAnswers
);

router.post(
  '/:id/start',
  authenticate,
  studentOnly,
  validateRequest({ params: uuidParamSchema }),
  studentCoursesController.start
);

router.get(
  '/:id/progress',
  authenticate,
  studentOnly,
  validateRequest({ params: uuidParamSchema }),
  studentCoursesController.progress
);

router.get(
  '/:id',
  authenticate,
  studentOnly,
  validateRequest({ params: uuidParamSchema }),
  studentCoursesController.getById
);

module.exports = router;
