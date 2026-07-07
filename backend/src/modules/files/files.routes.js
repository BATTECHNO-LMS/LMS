const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const { fileUploadLimiter } = require('./files.rateLimit.middleware');
const filesController = require('./files.controller');
const {
  presignUploadBodySchema,
  confirmUploadBodySchema,
  uuidParamSchema,
} = require('./files.validation');

const router = express.Router();

const adminOnly = authorizeRoles(env.SUPER_ADMIN_ROLE_CODE || 'super_admin');

router.post(
  '/presign-upload',
  authenticate,
  fileUploadLimiter,
  validateRequest({ body: presignUploadBodySchema }),
  filesController.presignUpload
);

router.post(
  '/confirm-upload',
  authenticate,
  fileUploadLimiter,
  validateRequest({ body: confirmUploadBodySchema }),
  filesController.confirmUpload
);

router.get('/health/storage', authenticate, adminOnly, filesController.health);

router.get(
  '/:id/download-url',
  authenticate,
  validateRequest({ params: uuidParamSchema }),
  filesController.downloadUrl
);

router.delete(
  '/:id',
  authenticate,
  validateRequest({ params: uuidParamSchema }),
  filesController.remove
);

module.exports = router;
