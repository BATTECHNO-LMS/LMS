const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const learningOutcomesController = require('./learningOutcomes.controller');
const {
  uuidParamSchema,
  updateLearningOutcomeBodySchema,
} = require('./learningOutcomes.validation');

const router = express.Router();

const curriculumRead = authorizeRoles(...env.CURRICULUM_READ_ROLE_CODES);
const curriculumWrite = authorizeRoles(...env.CURRICULUM_WRITE_ROLE_CODES);

router.get(
  '/:id',
  authenticate,
  curriculumRead,
  validateRequest({ params: uuidParamSchema }),
  learningOutcomesController.getById
);

router.put(
  '/:id',
  authenticate,
  curriculumWrite,
  validateRequest({ params: uuidParamSchema, body: updateLearningOutcomeBodySchema }),
  learningOutcomesController.update
);

router.delete(
  '/:id',
  authenticate,
  curriculumWrite,
  validateRequest({ params: uuidParamSchema }),
  learningOutcomesController.remove
);

module.exports = router;
