const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const rubricsController = require('./rubrics.controller');
const {
  uuidParamSchema,
  listRubricsQuerySchema,
  createRubricBodySchema,
  updateRubricBodySchema,
  createCriterionBodySchema,
  updateCriterionBodySchema,
} = require('./rubrics.validation');

const router = express.Router();

const academicRead = authorizeRoles(...env.ACADEMIC_READ_ROLE_CODES);
const academicWrite = authorizeRoles(...env.ACADEMIC_WRITE_ROLE_CODES);

router.get(
  '/',
  authenticate,
  academicRead,
  validateRequest({ query: listRubricsQuerySchema }),
  rubricsController.list
);

router.post(
  '/',
  authenticate,
  academicWrite,
  validateRequest({ body: createRubricBodySchema }),
  rubricsController.create
);

router.get(
  '/:id/criteria',
  authenticate,
  academicRead,
  validateRequest({ params: uuidParamSchema }),
  rubricsController.listCriteria
);

router.post(
  '/:id/criteria',
  authenticate,
  academicWrite,
  validateRequest({ params: uuidParamSchema, body: createCriterionBodySchema }),
  rubricsController.createCriterion
);

router.get('/:id', authenticate, academicRead, validateRequest({ params: uuidParamSchema }), rubricsController.getById);

router.put(
  '/:id',
  authenticate,
  academicWrite,
  validateRequest({ params: uuidParamSchema, body: updateRubricBodySchema }),
  rubricsController.update
);

module.exports = router;
