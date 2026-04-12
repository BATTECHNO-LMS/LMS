const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const usersController = require('./users.controller');
const {
  uuidParamSchema,
  listUsersQuerySchema,
  createUserBodySchema,
  updateUserBodySchema,
  patchUserStatusBodySchema,
} = require('./users.validation');

const router = express.Router();

const adminRead = authorizeRoles(...env.ADMIN_READ_ROLE_CODES);
const userWrite = authorizeRoles(...env.USER_WRITE_ROLE_CODES);

router.get(
  '/',
  authenticate,
  adminRead,
  validateRequest({ query: listUsersQuerySchema }),
  usersController.list
);

router.get(
  '/:id',
  authenticate,
  adminRead,
  validateRequest({ params: uuidParamSchema }),
  usersController.getById
);

router.post(
  '/',
  authenticate,
  userWrite,
  validateRequest({ body: createUserBodySchema }),
  usersController.create
);

router.put(
  '/:id',
  authenticate,
  userWrite,
  validateRequest({ params: uuidParamSchema, body: updateUserBodySchema }),
  usersController.update
);

router.patch(
  '/:id/status',
  authenticate,
  userWrite,
  validateRequest({ params: uuidParamSchema, body: patchUserStatusBodySchema }),
  usersController.patchStatus
);

module.exports = router;
