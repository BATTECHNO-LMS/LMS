'use strict';

const express = require('express');
const { z } = require('zod');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { success } = require('../../utils/apiResponse');
const reviewerAssignment = require('./reviewerAssignment.service');

const router = express.Router();
const superAdminOnly = authorizeRoles('super_admin');

const userIdParamSchema = z.object({
  userId: z.string().uuid(),
});

const assignBodySchema = z.object({
  university_id: z.string().uuid(),
});

router.get('/needing-assignment', authenticate, superAdminOnly, async (req, res, next) => {
  try {
    const data = await reviewerAssignment.listReviewersNeedingAssignment();
    return success(res, data, { message: 'Reviewers needing university assignment' });
  } catch (e) {
    return next(e);
  }
});

router.post(
  '/:userId/assign-university',
  authenticate,
  superAdminOnly,
  validateRequest({ params: userIdParamSchema, body: assignBodySchema }),
  async (req, res, next) => {
    try {
      const data = await reviewerAssignment.adminAssignReviewerUniversity(
        req.user,
        req.validated.params.userId,
        req.validated.body.university_id
      );
      return success(res, data, { message: 'تم تنسيب المراجع إلى الجامعة' });
    } catch (e) {
      return next(e);
    }
  }
);

router.patch(
  '/:userId/assign-university',
  authenticate,
  superAdminOnly,
  validateRequest({ params: userIdParamSchema, body: assignBodySchema }),
  async (req, res, next) => {
    try {
      const data = await reviewerAssignment.adminAssignReviewerUniversity(
        req.user,
        req.validated.params.userId,
        req.validated.body.university_id
      );
      return success(res, data, { message: 'تم تحديث تنسيب المراجع' });
    } catch (e) {
      return next(e);
    }
  }
);

router.delete(
  '/:userId/university-assignment',
  authenticate,
  superAdminOnly,
  validateRequest({ params: userIdParamSchema }),
  async (req, res, next) => {
    try {
      const data = await reviewerAssignment.adminDeactivateReviewerAssignment(
        req.user,
        req.validated.params.userId
      );
      return success(res, data, { message: 'تم إلغاء تنسيب المراجع' });
    } catch (e) {
      return next(e);
    }
  }
);

module.exports = router;
