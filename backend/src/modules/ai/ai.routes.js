const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const { aiGenerateLimiter } = require('./ai.rateLimit.middleware');
const aiController = require('./ai.controller');
const { generateBodySchema } = require('./ai.validation');

const router = express.Router();

const adminOnly = authorizeRoles(env.SUPER_ADMIN_ROLE_CODE || 'super_admin');

router.post(
  '/generate',
  authenticate,
  aiGenerateLimiter,
  validateRequest({ body: generateBodySchema }),
  aiController.generate
);

router.get('/status', authenticate, aiController.status);

router.get('/test', authenticate, adminOnly, aiController.test);

module.exports = router;
