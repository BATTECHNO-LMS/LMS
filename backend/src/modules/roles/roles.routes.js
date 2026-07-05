const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const rolesController = require('./roles.controller');
const { uuidParamSchema } = require('./roles.validation');

const router = express.Router();

const superAdminOnly = authorizeRoles(env.SUPER_ADMIN_ROLE_CODE || 'super_admin');

router.get('/', authenticate, superAdminOnly, rolesController.list);

router.get(
  '/:id',
  authenticate,
  superAdminOnly,
  validateRequest({ params: uuidParamSchema }),
  rolesController.getById
);

module.exports = router;
