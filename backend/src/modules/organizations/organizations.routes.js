'use strict';

const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const controller = require('./organizations.controller');
const {
  uuidParamSchema,
  orgIdParamSchema,
  branchIdParamSchema,
  createInstitutionBodySchema,
  updateInstitutionBodySchema,
  branchBodySchema,
  updateBranchBodySchema,
  departmentBodySchema,
  assignmentBodySchema,
  verifyEmailBodySchema,
  activationBodySchema,
  listMembersQuerySchema,
} = require('./organizations.validation');

const router = express.Router();

const orgRead = authorizeRoles('super_admin', 'admin', 'instructor', 'student', 'reviewer');
const orgWrite = authorizeRoles('super_admin', 'admin');
const superAdminOnly = authorizeRoles('super_admin');

router.get('/public/institutions', controller.listPublicInstitutions);
router.get(
  '/public/institutions/:organizationId/branches',
  validateRequest({ params: orgIdParamSchema }),
  controller.listPublicBranches
);
router.get(
  '/public/institutions/:organizationId/departments',
  validateRequest({ params: orgIdParamSchema }),
  controller.listPublicDepartments
);

router.get('/', authenticate, orgRead, controller.list);
router.get(
  '/:id',
  authenticate,
  orgRead,
  validateRequest({ params: uuidParamSchema }),
  controller.getById
);
router.post(
  '/institutions',
  authenticate,
  superAdminOnly,
  validateRequest({ body: createInstitutionBodySchema }),
  controller.createInstitution
);
router.put(
  '/institutions/:id',
  authenticate,
  orgWrite,
  validateRequest({ params: uuidParamSchema, body: updateInstitutionBodySchema }),
  controller.updateInstitution
);

router.get(
  '/:organizationId/branches',
  authenticate,
  orgRead,
  validateRequest({ params: orgIdParamSchema }),
  controller.listBranches
);
router.post(
  '/:organizationId/branches',
  authenticate,
  orgWrite,
  validateRequest({ params: orgIdParamSchema, body: branchBodySchema }),
  controller.createBranch
);
router.patch(
  '/:organizationId/branches/:branchId',
  authenticate,
  orgWrite,
  validateRequest({ params: branchIdParamSchema, body: updateBranchBodySchema }),
  controller.updateBranch
);
router.get(
  '/:organizationId/departments',
  authenticate,
  orgRead,
  validateRequest({ params: orgIdParamSchema }),
  controller.listDepartments
);
router.post(
  '/:organizationId/departments',
  authenticate,
  orgWrite,
  validateRequest({ params: orgIdParamSchema, body: departmentBodySchema }),
  controller.createDepartment
);
router.get(
  '/:organizationId/members',
  authenticate,
  orgRead,
  validateRequest({ params: orgIdParamSchema, query: listMembersQuerySchema }),
  controller.listMembers
);
router.post(
  '/:organizationId/assignments',
  authenticate,
  orgWrite,
  validateRequest({ params: orgIdParamSchema, body: assignmentBodySchema }),
  controller.assignUser
);
router.post(
  '/:organizationId/members/verify-email',
  authenticate,
  orgWrite,
  validateRequest({ params: orgIdParamSchema, body: verifyEmailBodySchema }),
  controller.verifyMemberEmail
);
router.post(
  '/:organizationId/members/activation',
  authenticate,
  orgWrite,
  validateRequest({ params: orgIdParamSchema, body: activationBodySchema }),
  controller.changeMemberActivation
);
router.get(
  '/:organizationId/dashboard',
  authenticate,
  orgRead,
  validateRequest({ params: orgIdParamSchema }),
  controller.dashboardSummary
);

module.exports = router;
