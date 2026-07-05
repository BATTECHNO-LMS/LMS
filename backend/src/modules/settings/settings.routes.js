const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const settingsController = require('./settings.controller');
const { updateSettingsBodySchema } = require('./settings.validation');

const router = express.Router();

const superAdminOnly = authorizeRoles(env.SUPER_ADMIN_ROLE_CODE || 'super_admin');

router.get('/', authenticate, superAdminOnly, settingsController.get);

router.put(
  '/',
  authenticate,
  superAdminOnly,
  validateRequest({ body: updateSettingsBodySchema }),
  settingsController.update
);

module.exports = router;
