const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const submissionsController = require('./submissions.controller');
const {
  uuidParamSchema,
  listSubmissionsQuerySchema,
  updateSubmissionBodySchema,
} = require('./submissions.validation');

const router = express.Router();

const academicRead = authorizeRoles(...env.ACADEMIC_READ_ROLE_CODES);

router.get(
  '/',
  authenticate,
  academicRead,
  validateRequest({ query: listSubmissionsQuerySchema }),
  submissionsController.list
);

router.get('/:id', authenticate, academicRead, validateRequest({ params: uuidParamSchema }), submissionsController.getById);

router.put(
  '/:id',
  authenticate,
  validateRequest({ params: uuidParamSchema, body: updateSubmissionBodySchema }),
  submissionsController.update
);

module.exports = router;
