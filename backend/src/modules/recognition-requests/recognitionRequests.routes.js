const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const recognitionRequestsController = require('./recognitionRequests.controller');
const recognitionDocumentsController = require('../recognition-documents/recognitionDocuments.controller');
const {
  uuidParamSchema,
  listRecognitionQuerySchema,
  createRecognitionBodySchema,
  updateRecognitionBodySchema,
  patchRecognitionStatusBodySchema,
} = require('./recognitionRequests.validation');
const { createDocumentBodySchema, updateDocumentBodySchema } = require('../recognition-documents/recognitionDocuments.validation');

const router = express.Router();
const recRead = authorizeRoles(...env.RECOGNITION_READ_ROLE_CODES);
const recWrite = authorizeRoles(...env.RECOGNITION_WRITE_ROLE_CODES);

router.get('/', authenticate, recRead, validateRequest({ query: listRecognitionQuerySchema }), recognitionRequestsController.list);

router.post(
  '/',
  authenticate,
  recWrite,
  validateRequest({ body: createRecognitionBodySchema }),
  recognitionRequestsController.create
);

router.get(
  '/:id/documents',
  authenticate,
  recRead,
  validateRequest({ params: uuidParamSchema }),
  recognitionDocumentsController.listForRequest
);

router.post(
  '/:id/documents',
  authenticate,
  recWrite,
  validateRequest({ params: uuidParamSchema, body: createDocumentBodySchema }),
  recognitionDocumentsController.createForRequest
);

router.patch(
  '/:id/status',
  authenticate,
  recRead,
  validateRequest({ params: uuidParamSchema, body: patchRecognitionStatusBodySchema }),
  recognitionRequestsController.patchStatus
);

router.get('/:id', authenticate, recRead, validateRequest({ params: uuidParamSchema }), recognitionRequestsController.getById);

router.put(
  '/:id',
  authenticate,
  recWrite,
  validateRequest({ params: uuidParamSchema, body: updateRecognitionBodySchema }),
  recognitionRequestsController.update
);

module.exports = router;
