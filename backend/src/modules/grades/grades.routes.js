const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const gradesController = require('./grades.controller');
const {
  uuidParamSchema,
  listGradesQuerySchema,
  updateGradeBodySchema,
} = require('./grades.validation');

const router = express.Router();

const academicRead = authorizeRoles(...env.ACADEMIC_READ_ROLE_CODES);
const academicWrite = authorizeRoles(...env.ACADEMIC_WRITE_ROLE_CODES);

router.get(
  '/',
  authenticate,
  academicRead,
  validateRequest({ query: listGradesQuerySchema }),
  gradesController.list
);

router.get('/:id', authenticate, academicRead, validateRequest({ params: uuidParamSchema }), gradesController.getById);

router.put(
  '/:id',
  authenticate,
  academicWrite,
  validateRequest({ params: uuidParamSchema, body: updateGradeBodySchema }),
  gradesController.update
);

router.patch(
  '/:id/finalize',
  authenticate,
  academicWrite,
  validateRequest({ params: uuidParamSchema }),
  gradesController.finalize
);

module.exports = router;
