'use strict';

const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { z } = require('zod');
const service = require('./kpi.service');
const { success, created } = require('../../utils/apiResponse');

const router = express.Router();
const read = authorizeRoles('super_admin', 'admin', 'instructor', 'reviewer');
const write = authorizeRoles('super_admin', 'admin');
const orgParam = z.object({ organizationId: z.string().uuid() });

router.get('/definitions', authenticate, read, async (_req, res, next) => {
  try {
    return success(res, await service.listDefinitions());
  } catch (e) {
    return next(e);
  }
});

router.get(
  '/organizations/:organizationId/compute',
  authenticate,
  read,
  validateRequest({ params: orgParam }),
  async (req, res, next) => {
    try {
      return success(res, await service.computeOrganizationKpis(req.user, req.validated.params.organizationId));
    } catch (e) {
      return next(e);
    }
  }
);

router.get(
  '/organizations/:organizationId/alerts',
  authenticate,
  read,
  validateRequest({ params: orgParam }),
  async (req, res, next) => {
    try {
      return success(res, await service.listAlerts(req.user, req.validated.params.organizationId));
    } catch (e) {
      return next(e);
    }
  }
);

router.post(
  '/organizations/:organizationId/targets',
  authenticate,
  write,
  validateRequest({
    params: orgParam,
    body: z.object({
      code: z.string(),
      target_value: z.number(),
      warn_value: z.number().optional().nullable(),
    }),
  }),
  async (req, res, next) => {
    try {
      return created(res, await service.setTarget(req.user, req.validated.params.organizationId, req.validated.body));
    } catch (e) {
      return next(e);
    }
  }
);

router.get(
  '/organizations/:organizationId/report',
  authenticate,
  read,
  validateRequest({ params: orgParam }),
  async (req, res, next) => {
    try {
      return success(res, await service.organizationReport(req.user, req.validated.params.organizationId));
    } catch (e) {
      return next(e);
    }
  }
);

module.exports = router;
