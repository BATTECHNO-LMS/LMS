const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const riskCasesController = require('./riskCases.controller');
const {
  uuidParamSchema,
  listRiskCasesQuerySchema,
  createRiskCaseBodySchema,
  updateRiskCaseBodySchema,
  patchRiskCaseStatusBodySchema,
} = require('./riskCases.validation');

const router = express.Router();
const riskRoles = authorizeRoles(...env.RISK_INTEGRITY_ROLE_CODES);

router.get('/', authenticate, riskRoles, validateRequest({ query: listRiskCasesQuerySchema }), riskCasesController.list);

router.post(
  '/',
  authenticate,
  riskRoles,
  validateRequest({ body: createRiskCaseBodySchema }),
  riskCasesController.create
);

router.get('/:id', authenticate, riskRoles, validateRequest({ params: uuidParamSchema }), riskCasesController.getById);

router.put(
  '/:id',
  authenticate,
  riskRoles,
  validateRequest({ params: uuidParamSchema, body: updateRiskCaseBodySchema }),
  riskCasesController.update
);

router.patch(
  '/:id/status',
  authenticate,
  riskRoles,
  validateRequest({ params: uuidParamSchema, body: patchRiskCaseStatusBodySchema }),
  riskCasesController.patchStatus
);

module.exports = router;
