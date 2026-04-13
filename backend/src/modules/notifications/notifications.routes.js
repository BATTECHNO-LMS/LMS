const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const notificationsController = require('./notifications.controller');
const { uuidParamSchema, listNotificationsQuerySchema } = require('./notifications.validation');

const router = express.Router();

router.get(
  '/',
  authenticate,
  validateRequest({ query: listNotificationsQuerySchema }),
  notificationsController.list
);

router.patch('/read-all', authenticate, notificationsController.markAllRead);

router.get('/:id', authenticate, validateRequest({ params: uuidParamSchema }), notificationsController.getById);

router.patch('/:id/read', authenticate, validateRequest({ params: uuidParamSchema }), notificationsController.markRead);

module.exports = router;
