const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const notificationsController = require('./notifications.controller');
const {
  uuidParamSchema,
  listNotificationsQuerySchema,
  preferencesBodySchema,
} = require('./notifications.validation');

const router = express.Router();

router.get(
  '/',
  authenticate,
  validateRequest({ query: listNotificationsQuerySchema }),
  notificationsController.list
);

router.get('/unread-count', authenticate, notificationsController.unreadCount);

router.get('/preferences', authenticate, notificationsController.getPreferences);

router.patch(
  '/preferences',
  authenticate,
  validateRequest({ body: preferencesBodySchema }),
  notificationsController.updatePreferences
);

router.patch('/read-all', authenticate, notificationsController.markAllRead);

router.get('/:id', authenticate, validateRequest({ params: uuidParamSchema }), notificationsController.getById);

router.patch('/:id/read', authenticate, validateRequest({ params: uuidParamSchema }), notificationsController.markRead);

router.post(
  '/:id/acknowledge',
  authenticate,
  validateRequest({ params: uuidParamSchema }),
  notificationsController.acknowledge
);

router.post(
  '/:id/archive',
  authenticate,
  validateRequest({ params: uuidParamSchema }),
  notificationsController.archive
);

module.exports = router;
