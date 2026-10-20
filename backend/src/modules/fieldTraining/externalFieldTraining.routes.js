const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const { success } = require('../../utils/apiResponse');
const { z } = require('zod');
const externalService = require('./fieldTraining.externalSupervisor.service');
const { isExternalSupervisorRole } = require('./fieldTraining.externalScope');
const { ApiError } = require('../../utils/apiError');

const router = express.Router();

const externalRoles = env.FIELD_TRAINING_EXTERNAL_SUPERVISOR_ROLE_CODES || ['external_supervisor'];
// Also allow instructors/admins who hold an active assignment (assignment is the real gate).
const portalRoles = [
  ...externalRoles,
  ...(env.FIELD_TRAINING_INSTRUCTOR_ROLE_CODES || []),
  ...(env.FIELD_TRAINING_ADMIN_ROLE_CODES || []),
];

function requireExternalPortal(req, res, next) {
  // Assignment-scoped: role alone is insufficient; handlers assert assignment.
  // Allow known portal roles OR any authenticated user who may have assignments.
  if (!req.user?.userId) return next(new ApiError(401, 'Unauthorized'));
  return next();
}

const applicationIdParam = z.object({ applicationId: z.string().uuid() });
const entryIdParam = z.object({ entryId: z.string().uuid() });

const hoursBody = z.object({
  completed_hours: z.coerce.number(),
  expected_completed_hours: z.coerce.number().optional(),
  note: z.string().max(2000).optional().nullable(),
});

const hoursCorrectionBody = z.object({
  note: z.string().trim().min(1).max(2000).optional(),
  reason: z.string().trim().min(1).max(2000).optional(),
});

const evaluationBody = z
  .object({
    thinking_and_initiative: z.coerce.number().optional(),
    problem_solving: z.coerce.number().optional(),
    teamwork: z.coerce.number().optional(),
    professional_conduct: z.coerce.number().optional(),
    supervisor_cooperation: z.coerce.number().optional(),
    rules_compliance: z.coerce.number().optional(),
    notes: z.string().max(4000).optional().nullable(),
    student_feedback: z.string().max(4000).optional().nullable(),
  })
  .passthrough();

const logbookReviewBody = z.object({
  action: z.enum(['REQUEST_REVISION', 'REVISION_REQUESTED', 'COMMENT', 'VERIFY']),
  comment: z.string().max(4000).optional().nullable(),
  note: z.string().max(4000).optional().nullable(),
});

router.get('/dashboard', authenticate, requireExternalPortal, async (req, res, next) => {
  try {
    const data = await externalService.getDashboard(req.user);
    return success(res, data);
  } catch (e) {
    return next(e);
  }
});

router.get(
  '/students/:applicationId',
  authenticate,
  requireExternalPortal,
  validateRequest({ params: applicationIdParam }),
  async (req, res, next) => {
    try {
      const data = await externalService.getStudentDetail(req.validated.params.applicationId, req.user);
      return success(res, data);
    } catch (e) {
      return next(e);
    }
  }
);

router.post(
  '/students/:applicationId/hours/confirm',
  authenticate,
  requireExternalPortal,
  validateRequest({ params: applicationIdParam, body: hoursBody }),
  async (req, res, next) => {
    try {
      const data = await externalService.confirmHours(
        req.validated.params.applicationId,
        req.validated.body,
        req.user
      );
      return success(res, data, { message: 'Hours confirmed' });
    } catch (e) {
      return next(e);
    }
  }
);

router.post(
  '/students/:applicationId/hours/request-correction',
  authenticate,
  requireExternalPortal,
  validateRequest({ params: applicationIdParam, body: hoursCorrectionBody }),
  async (req, res, next) => {
    try {
      const data = await externalService.requestHoursCorrection(
        req.validated.params.applicationId,
        req.validated.body,
        req.user
      );
      return success(res, data);
    } catch (e) {
      return next(e);
    }
  }
);

router.post(
  '/students/:applicationId/evaluation',
  authenticate,
  requireExternalPortal,
  validateRequest({ params: applicationIdParam, body: evaluationBody }),
  async (req, res, next) => {
    try {
      const data = await externalService.submitEvaluation(
        req.validated.params.applicationId,
        req.validated.body,
        req.user
      );
      return success(res, data, { message: 'Evaluation submitted' });
    } catch (e) {
      return next(e);
    }
  }
);

router.post(
  '/logbook/:entryId/review',
  authenticate,
  requireExternalPortal,
  validateRequest({ params: entryIdParam, body: logbookReviewBody }),
  async (req, res, next) => {
    try {
      const data = await externalService.reviewLogbook(
        req.validated.params.entryId,
        req.validated.body,
        req.user
      );
      return success(res, data);
    } catch (e) {
      return next(e);
    }
  }
);

module.exports = router;
module.exports.portalRoles = portalRoles;
module.exports.isExternalSupervisorRole = isExternalSupervisorRole;
