const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const integrityCasesController = require('./integrityCases.controller');
const {
  uuidParamSchema,
  listIntegrityCasesQuerySchema,
  createIntegrityCaseBodySchema,
  updateIntegrityCaseBodySchema,
  patchIntegrityCaseStatusBodySchema,
} = require('./integrityCases.validation');

const router = express.Router();
const integrityRoles = authorizeRoles(...env.RISK_INTEGRITY_ROLE_CODES);

router.get(
  '/',
  authenticate,
  integrityRoles,
  validateRequest({ query: listIntegrityCasesQuerySchema }),
  integrityCasesController.list
);

router.post(
  '/',
  authenticate,
  integrityRoles,
  validateRequest({ body: createIntegrityCaseBodySchema }),
  integrityCasesController.create
);

router.get('/:id', authenticate, integrityRoles, validateRequest({ params: uuidParamSchema }), integrityCasesController.getById);

router.put(
  '/:id',
  authenticate,
  integrityRoles,
  validateRequest({ params: uuidParamSchema, body: updateIntegrityCaseBodySchema }),
  integrityCasesController.update
);

router.patch(
  '/:id/status',
  authenticate,
  integrityRoles,
  validateRequest({ params: uuidParamSchema, body: patchIntegrityCaseStatusBodySchema }),
  integrityCasesController.patchStatus
);

module.exports = router;
