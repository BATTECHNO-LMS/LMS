const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const correctiveActionsController = require('./correctiveActions.controller');
const {
  uuidParamSchema,
  listCorrectiveQuerySchema,
  createCorrectiveBodySchema,
  updateCorrectiveBodySchema,
  patchCorrectiveStatusBodySchema,
} = require('./correctiveActions.validation');

const router = express.Router();
const qaRoles = authorizeRoles(...env.QA_OVERSIGHT_ROLE_CODES);

router.get(
  '/',
  authenticate,
  qaRoles,
  validateRequest({ query: listCorrectiveQuerySchema }),
  correctiveActionsController.list
);

router.post(
  '/',
  authenticate,
  qaRoles,
  validateRequest({ body: createCorrectiveBodySchema }),
  correctiveActionsController.create
);

router.get('/:id', authenticate, qaRoles, validateRequest({ params: uuidParamSchema }), correctiveActionsController.getById);

router.put(
  '/:id',
  authenticate,
  qaRoles,
  validateRequest({ params: uuidParamSchema, body: updateCorrectiveBodySchema }),
  correctiveActionsController.update
);

router.patch(
  '/:id/status',
  authenticate,
  qaRoles,
  validateRequest({ params: uuidParamSchema, body: patchCorrectiveStatusBodySchema }),
  correctiveActionsController.patchStatus
);

module.exports = router;
