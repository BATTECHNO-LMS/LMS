const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const certificatesController = require('./certificates.controller');
const {
  verifyParamSchema,
  uuidParamSchema,
  listCertificatesQuerySchema,
  createCertificateBodySchema,
  patchCertificateStatusBodySchema,
} = require('./certificates.validation');

const router = express.Router();
const certRead = authorizeRoles(...env.CERTIFICATE_READ_ROLE_CODES);
const certWrite = authorizeRoles(...env.CERTIFICATE_WRITE_ROLE_CODES);

router.get(
  '/verify/:verificationCode',
  validateRequest({ params: verifyParamSchema }),
  certificatesController.verify
);

router.get(
  '/',
  authenticate,
  certRead,
  validateRequest({ query: listCertificatesQuerySchema }),
  certificatesController.list
);

router.post(
  '/',
  authenticate,
  certWrite,
  validateRequest({ body: createCertificateBodySchema }),
  certificatesController.create
);

router.patch(
  '/:id/status',
  authenticate,
  certWrite,
  validateRequest({ params: uuidParamSchema, body: patchCertificateStatusBodySchema }),
  certificatesController.patchStatus
);

router.get('/:id', authenticate, certRead, validateRequest({ params: uuidParamSchema }), certificatesController.getById);

module.exports = router;
