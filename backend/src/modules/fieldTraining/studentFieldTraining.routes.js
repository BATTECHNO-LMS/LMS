const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const studentFieldTrainingController = require('./studentFieldTraining.controller');
const {
  uuidParamSchema,
  applicationIdParamSchema,
  listStudentQuerySchema,
  applyBodySchema,
  taskIdParamSchema,
  submissionIdParamSchema,
} = require('./fieldTraining.validation');
const { handleTaskUpload } = require('./fieldTraining.upload');

const router = express.Router();
const studentOnly = authorizeRoles(env.STUDENT_ROLE_CODE);

router.get(
  '/my-applications',
  authenticate,
  studentOnly,
  studentFieldTrainingController.myApplications
);

router.patch(
  '/applications/:applicationId/cancel',
  authenticate,
  studentOnly,
  validateRequest({ params: applicationIdParamSchema }),
  studentFieldTrainingController.cancel
);

router.get(
  '/',
  authenticate,
  studentOnly,
  validateRequest({ query: listStudentQuerySchema }),
  studentFieldTrainingController.list
);

router.get(
  '/submissions/:submissionId/download',
  authenticate,
  studentOnly,
  validateRequest({ params: submissionIdParamSchema }),
  studentFieldTrainingController.downloadSubmission
);

router.get(
  '/:id/tasks',
  authenticate,
  studentOnly,
  validateRequest({ params: uuidParamSchema }),
  studentFieldTrainingController.listTasks
);

router.post(
  '/tasks/:taskId/submit',
  authenticate,
  studentOnly,
  validateRequest({ params: taskIdParamSchema }),
  handleTaskUpload,
  studentFieldTrainingController.submitTask
);

router.get(
  '/:id',
  authenticate,
  studentOnly,
  validateRequest({ params: uuidParamSchema }),
  studentFieldTrainingController.getById
);

router.post(
  '/:id/apply',
  authenticate,
  studentOnly,
  validateRequest({ params: uuidParamSchema, body: applyBodySchema }),
  studentFieldTrainingController.apply
);

module.exports = router;
