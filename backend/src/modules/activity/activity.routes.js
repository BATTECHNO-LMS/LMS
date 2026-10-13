const express = require('express');
const { z } = require('zod');
const { authenticate } = require('../../middlewares/auth.middleware');
const { validateBody } = require('../../middlewares/validate.middleware');
const { success } = require('../../utils/apiResponse');
const { NAVIGATION_ACTIONS } = require('../../shared/audit/auditActions');
const activityService = require('./activity.service');

const router = express.Router();

const navigationSchema = z
  .object({
    module: z.enum(Object.keys(NAVIGATION_ACTIONS)),
    entity_id: z.string().uuid().optional().nullable(),
    entity_type: z.string().max(60).optional().nullable(),
    report_key: z.string().max(60).optional().nullable(),
  })
  .strict();

router.post('/navigation', authenticate, validateBody(navigationSchema), async (req, res, next) => {
  try {
    const body = req.validated;
    const result = await activityService.recordNavigation({
      userId: req.user.userId,
      sessionId: req.user.sessionId || null,
      module: body.module,
      entityId: body.entity_id || null,
      entityType: body.entity_type || null,
      reportKey: body.report_key || null,
    });
    return success(res, result, { message: 'OK' });
  } catch (e) {
    return next(e);
  }
});

module.exports = router;
