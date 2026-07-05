const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const modulesController = require('./modules.controller');
const { listModulesQuerySchema } = require('./modules.validation');

const router = express.Router();

const curriculumRead = authorizeRoles(...env.CURRICULUM_READ_ROLE_CODES);

router.get(
  '/',
  authenticate,
  curriculumRead,
  validateRequest({ query: listModulesQuerySchema }),
  modulesController.list
);

module.exports = router;
