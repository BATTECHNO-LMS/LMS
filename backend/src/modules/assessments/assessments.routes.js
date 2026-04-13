const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const assessmentsController = require('./assessments.controller');
const submissionsController = require('../submissions/submissions.controller');
const gradesController = require('../grades/grades.controller');
const {
  uuidParamSchema,
  listAssessmentsQuerySchema,
  createAssessmentBodySchema,
  updateAssessmentBodySchema,
  patchAssessmentStatusBodySchema,
} = require('./assessments.validation');
const { createSubmissionBodySchema } = require('../submissions/submissions.validation');
const { createGradeBodySchema } = require('../grades/grades.validation');

const router = express.Router();

const academicRead = authorizeRoles(...env.ACADEMIC_READ_ROLE_CODES);
const academicWrite = authorizeRoles(...env.ACADEMIC_WRITE_ROLE_CODES);
const studentOnly = authorizeRoles(env.STUDENT_ROLE_CODE);

router.get(
  '/',
  authenticate,
  academicRead,
  validateRequest({ query: listAssessmentsQuerySchema }),
  assessmentsController.list
);

router.post(
  '/',
  authenticate,
  academicWrite,
  validateRequest({ body: createAssessmentBodySchema }),
  assessmentsController.create
);

router.get(
  '/:id/submissions',
  authenticate,
  academicRead,
  validateRequest({ params: uuidParamSchema }),
  submissionsController.listByAssessment
);

router.post(
  '/:id/submissions',
  authenticate,
  studentOnly,
  validateRequest({ params: uuidParamSchema, body: createSubmissionBodySchema }),
  submissionsController.createForAssessment
);

router.get(
  '/:id/grades',
  authenticate,
  academicRead,
  validateRequest({ params: uuidParamSchema }),
  gradesController.listByAssessment
);

router.post(
  '/:id/grades',
  authenticate,
  academicWrite,
  validateRequest({ params: uuidParamSchema, body: createGradeBodySchema }),
  gradesController.createForAssessment
);

router.patch(
  '/:id/status',
  authenticate,
  academicWrite,
  validateRequest({ params: uuidParamSchema, body: patchAssessmentStatusBodySchema }),
  assessmentsController.patchStatus
);

router.get('/:id', authenticate, academicRead, validateRequest({ params: uuidParamSchema }), assessmentsController.getById);

router.put(
  '/:id',
  authenticate,
  academicWrite,
  validateRequest({ params: uuidParamSchema, body: updateAssessmentBodySchema }),
  assessmentsController.update
);

module.exports = router;
