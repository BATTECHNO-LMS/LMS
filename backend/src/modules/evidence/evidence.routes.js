const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const evidenceController = require('./evidence.controller');
const {
  uuidParamSchema,
  listEvidenceQuerySchema,
  createEvidenceBodySchema,
  updateEvidenceBodySchema,
} = require('./evidence.validation');

const router = express.Router();

const evidenceRead = authorizeRoles(...env.EVIDENCE_READ_ROLE_CODES);
const evidenceWrite = authorizeRoles(...env.EVIDENCE_WRITE_ROLE_CODES);

router.get('/', authenticate, evidenceRead, validateRequest({ query: listEvidenceQuerySchema }), evidenceController.list);

router.post(
  '/',
  authenticate,
  evidenceWrite,
  validateRequest({ body: createEvidenceBodySchema }),
  evidenceController.create
);

router.get('/:id', authenticate, evidenceRead, validateRequest({ params: uuidParamSchema }), evidenceController.getById);

router.put(
  '/:id',
  authenticate,
  evidenceWrite,
  validateRequest({ params: uuidParamSchema, body: updateEvidenceBodySchema }),
  evidenceController.update
);

module.exports = router;
