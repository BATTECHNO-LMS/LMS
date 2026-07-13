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
  adminResetPasswordBodySchema,
  activatePendingQuerySchema,
  activatePendingBodySchema,
  verifyAllEmailsQuerySchema,
  verifyAllEmailsBodySchema,
  bulkVerifyEmailsBodySchema,
} = require('./users.validation');

const router = express.Router();

const adminRead = authorizeRoles(...env.ADMIN_READ_ROLE_CODES);
const userWrite = authorizeRoles(...env.USER_WRITE_ROLE_CODES);
const userActivate = authorizeRoles(...env.USER_ACTIVATE_ROLE_CODES);

router.get(
  '/',
  authenticate,
  adminRead,
  validateRequest({ query: listUsersQuerySchema }),
  usersController.list
);

router.post(
  '/activate-pending',
  authenticate,
  userActivate,
  validateRequest({ query: activatePendingQuerySchema, body: activatePendingBodySchema }),
  usersController.activateAllPending
);

router.post(
  '/verify-all-emails',
  authenticate,
  userActivate,
  validateRequest({ query: verifyAllEmailsQuerySchema, body: verifyAllEmailsBodySchema }),
  usersController.verifyAllEmails
);

router.post(
  '/bulk-verify-emails',
  authenticate,
  userActivate,
  validateRequest({ body: bulkVerifyEmailsBodySchema }),
  usersController.bulkVerifyEmails
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

router.post(
  '/:id/reset-password',
  authenticate,
  userWrite,
  validateRequest({ params: uuidParamSchema, body: adminResetPasswordBodySchema }),
  usersController.resetPassword
);

router.patch(
  '/:id/activate',
  authenticate,
  userActivate,
  validateRequest({ params: uuidParamSchema }),
  usersController.activate
);

router.post(
  '/:id/verify-email',
  authenticate,
  userActivate,
  validateRequest({ params: uuidParamSchema }),
  usersController.verifyEmail
);

module.exports = router;
