const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const adminFieldTrainingController = require('./adminFieldTraining.controller');
const {
  uuidParamSchema,
  applicationIdParamSchema,
  submissionIdParamSchema,
  listAdminQuerySchema,
  listAdminStatsQuerySchema,
  opportunityBodySchema,
  updateOpportunityBodySchema,
  reviewApplicationBodySchema,
  taskIdParamSchema,
  taskBodySchema,
  updateTaskBodySchema,
} = require('./fieldTraining.validation');

const router = express.Router();
const fieldTrainingAdmin = authorizeRoles(...env.FIELD_TRAINING_ADMIN_ROLE_CODES);

router.get(
  '/stats',
  authenticate,
  fieldTrainingAdmin,
  validateRequest({ query: listAdminStatsQuerySchema }),
  adminFieldTrainingController.stats
);

router.patch(
  '/applications/:applicationId/status',
  authenticate,
  fieldTrainingAdmin,
  validateRequest({ params: applicationIdParamSchema, body: reviewApplicationBodySchema }),
  adminFieldTrainingController.reviewApplication
);

router.get(
  '/',
  authenticate,
  fieldTrainingAdmin,
  validateRequest({ query: listAdminQuerySchema }),
  adminFieldTrainingController.list
);

router.post(
  '/',
  authenticate,
  fieldTrainingAdmin,
  validateRequest({ body: opportunityBodySchema }),
  adminFieldTrainingController.create
);

router.get(
  '/submissions/:submissionId/download',
  authenticate,
  fieldTrainingAdmin,
  validateRequest({ params: submissionIdParamSchema }),
  adminFieldTrainingController.downloadSubmission
);

router.get(
  '/:id/applications',
  authenticate,
  fieldTrainingAdmin,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.listApplications
);

router.get(
  '/:id/tasks',
  authenticate,
  fieldTrainingAdmin,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.listTasks
);

router.post(
  '/:id/tasks',
  authenticate,
  fieldTrainingAdmin,
  validateRequest({ params: uuidParamSchema, body: taskBodySchema }),
  adminFieldTrainingController.createTask
);

router.get(
  '/:id/submissions',
  authenticate,
  fieldTrainingAdmin,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.listSubmissions
);

router.patch(
  '/tasks/:taskId',
  authenticate,
  fieldTrainingAdmin,
  validateRequest({ params: taskIdParamSchema, body: updateTaskBodySchema }),
  adminFieldTrainingController.updateTask
);

router.delete(
  '/tasks/:taskId',
  authenticate,
  fieldTrainingAdmin,
  validateRequest({ params: taskIdParamSchema }),
  adminFieldTrainingController.deleteTask
);

router.get(
  '/:id',
  authenticate,
  fieldTrainingAdmin,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.getById
);

router.patch(
  '/:id',
  authenticate,
  fieldTrainingAdmin,
  validateRequest({ params: uuidParamSchema, body: updateOpportunityBodySchema }),
  adminFieldTrainingController.update
);

router.post(
  '/:id/publish',
  authenticate,
  fieldTrainingAdmin,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.publish
);

router.post(
  '/:id/archive',
  authenticate,
  fieldTrainingAdmin,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.archive
);

module.exports = router;
