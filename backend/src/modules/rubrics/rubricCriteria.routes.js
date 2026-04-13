const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const rubricsController = require('./rubrics.controller');
const { criterionIdParamSchema, updateCriterionBodySchema } = require('./rubrics.validation');

const router = express.Router();

const academicWrite = authorizeRoles(...env.ACADEMIC_WRITE_ROLE_CODES);

router.put(
  '/:id',
  authenticate,
  academicWrite,
  validateRequest({ params: criterionIdParamSchema, body: updateCriterionBodySchema }),
  rubricsController.updateCriterion
);

router.delete(
  '/:id',
  authenticate,
  academicWrite,
  validateRequest({ params: criterionIdParamSchema }),
  rubricsController.deleteCriterion
);

module.exports = router;
