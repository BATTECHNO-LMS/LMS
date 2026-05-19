const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const adminFieldTrainingController = require('./adminFieldTraining.controller');
const {
  uuidParamSchema,
  applicationIdParamSchema,
  listAdminQuerySchema,
  opportunityBodySchema,
  updateOpportunityBodySchema,
  reviewApplicationBodySchema,
  taskIdParamSchema,
  taskBodySchema,
  updateTaskBodySchema,
} = require('./fieldTraining.validation');

const router = express.Router();
const superAdminOnly = authorizeRoles(env.SUPER_ADMIN_ROLE_CODE || 'super_admin');

router.patch(
  '/applications/:applicationId/status',
  authenticate,
  superAdminOnly,
  validateRequest({ params: applicationIdParamSchema, body: reviewApplicationBodySchema }),
  adminFieldTrainingController.reviewApplication
);

router.get(
  '/',
  authenticate,
  superAdminOnly,
  validateRequest({ query: listAdminQuerySchema }),
  adminFieldTrainingController.list
);

router.post(
  '/',
  authenticate,
  superAdminOnly,
  validateRequest({ body: opportunityBodySchema }),
  adminFieldTrainingController.create
);

router.get(
  '/:id/applications',
  authenticate,
  superAdminOnly,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.listApplications
);

router.get(
  '/:id/tasks',
  authenticate,
  superAdminOnly,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.listTasks
);

router.post(
  '/:id/tasks',
  authenticate,
  superAdminOnly,
  validateRequest({ params: uuidParamSchema, body: taskBodySchema }),
  adminFieldTrainingController.createTask
);

router.get(
  '/:id/submissions',
  authenticate,
  superAdminOnly,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.listSubmissions
);

router.patch(
  '/tasks/:taskId',
  authenticate,
  superAdminOnly,
  validateRequest({ params: taskIdParamSchema, body: updateTaskBodySchema }),
  adminFieldTrainingController.updateTask
);

router.delete(
  '/tasks/:taskId',
  authenticate,
  superAdminOnly,
  validateRequest({ params: taskIdParamSchema }),
  adminFieldTrainingController.deleteTask
);

router.get(
  '/:id',
  authenticate,
  superAdminOnly,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.getById
);

router.patch(
  '/:id',
  authenticate,
  superAdminOnly,
  validateRequest({ params: uuidParamSchema, body: updateOpportunityBodySchema }),
  adminFieldTrainingController.update
);

router.post(
  '/:id/publish',
  authenticate,
  superAdminOnly,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.publish
);

router.post(
  '/:id/archive',
  authenticate,
  superAdminOnly,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.archive
);

module.exports = router;
