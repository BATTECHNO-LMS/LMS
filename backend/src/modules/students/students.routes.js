const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const submissionsController = require('../submissions/submissions.controller');
const gradesController = require('../grades/grades.controller');
const { studentIdParamSchema } = require('../submissions/submissions.validation');

const router = express.Router();

const academicRead = authorizeRoles(...env.ACADEMIC_READ_ROLE_CODES);

router.get(
  '/:studentId/submissions',
  authenticate,
  academicRead,
  validateRequest({ params: studentIdParamSchema }),
  submissionsController.listByStudent
);

router.get(
  '/:studentId/grades',
  authenticate,
  academicRead,
  validateRequest({ params: studentIdParamSchema }),
  gradesController.listByStudent
);

module.exports = router;
