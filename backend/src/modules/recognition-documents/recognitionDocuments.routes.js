const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const recognitionDocumentsController = require('./recognitionDocuments.controller');
const { uuidParamSchema, updateDocumentBodySchema } = require('./recognitionDocuments.validation');

const router = express.Router();
const recRead = authorizeRoles(...env.RECOGNITION_READ_ROLE_CODES);
const recWrite = authorizeRoles(...env.RECOGNITION_WRITE_ROLE_CODES);

router.get('/:id', authenticate, recRead, validateRequest({ params: uuidParamSchema }), recognitionDocumentsController.getById);

router.put(
  '/:id',
  authenticate,
  recWrite,
  validateRequest({ params: uuidParamSchema, body: updateDocumentBodySchema }),
  recognitionDocumentsController.update
);

router.delete('/:id', authenticate, recWrite, validateRequest({ params: uuidParamSchema }), recognitionDocumentsController.remove);

module.exports = router;
