const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const microCredentialsController = require('./microCredentials.controller');
const {
  uuidParamSchema,
  microCredentialIdParamSchema,
  listMicroCredentialsQuerySchema,
  createMicroCredentialBodySchema,
  updateMicroCredentialBodySchema,
  patchMicroCredentialStatusBodySchema,
} = require('./microCredentials.validation');
const {
  createLearningOutcomeBodySchema,
} = require('../learning-outcomes/learningOutcomes.validation');

const router = express.Router();

const curriculumRead = authorizeRoles(...env.CURRICULUM_READ_ROLE_CODES);
const curriculumWrite = authorizeRoles(...env.CURRICULUM_WRITE_ROLE_CODES);

router.get(
  '/',
  authenticate,
  curriculumRead,
  validateRequest({ query: listMicroCredentialsQuerySchema }),
  microCredentialsController.list
);

router.post(
  '/',
  authenticate,
  curriculumWrite,
  validateRequest({ body: createMicroCredentialBodySchema }),
  microCredentialsController.create
);

router.get(
  '/:microCredentialId/learning-outcomes',
  authenticate,
  curriculumRead,
  validateRequest({ params: microCredentialIdParamSchema }),
  microCredentialsController.listLearningOutcomes
);

router.post(
  '/:microCredentialId/learning-outcomes',
  authenticate,
  curriculumWrite,
  validateRequest({ params: microCredentialIdParamSchema, body: createLearningOutcomeBodySchema }),
  microCredentialsController.createLearningOutcome
);

router.get(
  '/:id',
  authenticate,
  curriculumRead,
  validateRequest({ params: uuidParamSchema }),
  microCredentialsController.getById
);

router.put(
  '/:id',
  authenticate,
  curriculumWrite,
  validateRequest({ params: uuidParamSchema, body: updateMicroCredentialBodySchema }),
  microCredentialsController.update
);

router.patch(
  '/:id/status',
  authenticate,
  curriculumWrite,
  validateRequest({ params: uuidParamSchema, body: patchMicroCredentialStatusBodySchema }),
  microCredentialsController.patchStatus
);

module.exports = router;
