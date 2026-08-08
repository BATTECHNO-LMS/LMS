'use strict';

const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const env = require('../../config/env');
const controller = require('./accountDeletion.controller');
const {
  createDeletionRequestSchema,
  processDeletionRequestSchema,
} = require('./accountDeletion.validation');

const router = express.Router();

const superAdminOnly = authorizeRoles(env.SUPER_ADMIN_ROLE_CODE || 'super_admin');

// Self-service (authenticated active users of supported roles)
router.get('/deletion-request', authenticate, controller.getMine);
router.post(
  '/deletion-request',
  authenticate,
  validateRequest({ body: createDeletionRequestSchema }),
  controller.createMine
);
router.post('/deletion-request/cancel', authenticate, controller.cancelMine);

// Super Admin processing (global only — not university-scoped roles)
router.get('/deletion-requests', authenticate, superAdminOnly, controller.listAdmin);
router.patch(
  '/deletion-requests/:id',
  authenticate,
  superAdminOnly,
  validateRequest({ body: processDeletionRequestSchema }),
  controller.processAdmin
);

module.exports = router;
