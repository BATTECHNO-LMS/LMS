const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles, requireOrganizationType } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const submissionsController = require('./submissions.controller');
const {
  uuidParamSchema,
  listSubmissionsQuerySchema,
  updateSubmissionBodySchema,
} = require('./submissions.validation');

const router = express.Router();
router.use(authenticate);
router.use(requireOrganizationType('UNIVERSITY'));

const academicRead = authorizeRoles(...env.ACADEMIC_READ_ROLE_CODES);
const studentOnly = authorizeRoles(env.STUDENT_ROLE_CODE);

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
  studentOnly,
  validateRequest({ params: uuidParamSchema, body: updateSubmissionBodySchema }),
  submissionsController.update
);

module.exports = router;
