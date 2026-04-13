const { z } = require('zod');

const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

const riskCaseStatusEnum = z.enum(['open', 'in_progress', 'resolved', 'closed', 'escalated']);
const riskTypeEnum = z.enum([
  'low_attendance',
  'assessment_failure',
  'missing_project',
  'continuous_decline',
  'other',
]);
const riskLevelEnum = z.enum(['low', 'medium', 'high', 'critical']);

const listRiskCasesQuerySchema = z
  .object({
    cohort_id: z.string().uuid().optional(),
    student_id: z.string().uuid().optional(),
    risk_type: riskTypeEnum.optional(),
    risk_level: riskLevelEnum.optional(),
    status: riskCaseStatusEnum.optional(),
    search: z.string().max(255).optional(),
  })
  .strict()
  .transform((q) => ({
    cohort_id: q.cohort_id,
    student_id: q.student_id,
    risk_type: q.risk_type,
    risk_level: q.risk_level,
    status: q.status,
    search: q.search?.trim() || undefined,
  }));

const createRiskCaseBodySchema = z
  .object({
    cohort_id: z.string().uuid(),
    student_id: z.string().uuid(),
    risk_type: riskTypeEnum,
    risk_level: riskLevelEnum,
    opened_by: z.string().uuid().optional().nullable(),
    action_plan: z.string().max(20000).optional().nullable(),
    status: riskCaseStatusEnum.optional(),
  })
  .strict();

const updateRiskCaseBodySchema = z
  .object({
    risk_level: riskLevelEnum.optional(),
    opened_by: z.string().uuid().optional().nullable(),
    action_plan: z.string().max(20000).optional().nullable(),
    status: riskCaseStatusEnum.optional(),
  })
  .strict();

const patchRiskCaseStatusBodySchema = z
  .object({
    status: riskCaseStatusEnum,
  })
  .strict();

module.exports = {
  uuidParamSchema,
  listRiskCasesQuerySchema,
  createRiskCaseBodySchema,
  updateRiskCaseBodySchema,
  patchRiskCaseStatusBodySchema,
};
