const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const mobilePushController = require('./mobilePush.controller');
const { registerPushSchema, unregisterPushSchema } = require('./mobilePush.validation');

const router = express.Router();

router.post(
  '/register',
  authenticate,
  validateRequest({ body: registerPushSchema }),
  mobilePushController.register
);

router.delete(
  '/register',
  authenticate,
  validateRequest({ body: unregisterPushSchema }),
  mobilePushController.unregister
);

router.delete('/register-all', authenticate, mobilePushController.unregisterAll);

module.exports = router;
