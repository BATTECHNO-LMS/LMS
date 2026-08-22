const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles, requireOrganizationType } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const universitiesController = require('./universities.controller');
const {
  uuidParamSchema,
  emptyListQuerySchema,
  getUniversityQuerySchema,
  createUniversityBodySchema,
  updateUniversityBodySchema,
} = require('./universities.validation');

const router = express.Router();

const adminRead = authorizeRoles(...env.ADMIN_READ_ROLE_CODES);
const universityWrite = authorizeRoles(...env.UNIVERSITY_WRITE_ROLE_CODES);
const universityPortal = requireOrganizationType('UNIVERSITY');

router.get(
  '/',
  authenticate,
  universityPortal,
  adminRead,
  validateRequest({ query: emptyListQuerySchema }),
  universitiesController.list
);

router.get(
  '/:id',
  authenticate,
  universityPortal,
  adminRead,
  validateRequest({ params: uuidParamSchema, query: getUniversityQuerySchema }),
  universitiesController.getById
);

router.post(
  '/',
  authenticate,
  universityPortal,
  universityWrite,
  validateRequest({ body: createUniversityBodySchema }),
  universitiesController.create
);

router.put(
  '/:id',
  authenticate,
  universityPortal,
  universityWrite,
  validateRequest({ params: uuidParamSchema, body: updateUniversityBodySchema }),
  universitiesController.update
);

module.exports = router;
