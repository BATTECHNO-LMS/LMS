const { z } = require('zod');

const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

const integrityCaseStatusEnum = z.enum(['reported', 'under_investigation', 'resolved', 'closed']);
const integrityCaseTypeEnum = z.enum([
  'cheating',
  'plagiarism',
  'non_original_submission',
  'attendance_manipulation',
  'unauthorized_tools',
  'other',
]);

const listIntegrityCasesQuerySchema = z
  .object({
    cohort_id: z.string().uuid().optional(),
    student_id: z.string().uuid().optional(),
    assessment_id: z.string().uuid().optional(),
    case_type: integrityCaseTypeEnum.optional(),
    status: integrityCaseStatusEnum.optional(),
    search: z.string().max(255).optional(),
  })
  .strict()
  .transform((q) => ({
    cohort_id: q.cohort_id,
    student_id: q.student_id,
    assessment_id: q.assessment_id,
    case_type: q.case_type,
    status: q.status,
    search: q.search?.trim() || undefined,
  }));

const createIntegrityCaseBodySchema = z
  .object({
    cohort_id: z.string().uuid(),
    student_id: z.string().uuid(),
    case_type: integrityCaseTypeEnum,
    assessment_id: z.string().uuid().optional().nullable(),
    reported_by: z.string().uuid().optional().nullable(),
    evidence_notes: z.string().max(20000).optional().nullable(),
    decision: z.string().max(20000).optional().nullable(),
    status: integrityCaseStatusEnum.optional(),
  })
  .strict();

const updateIntegrityCaseBodySchema = z
  .object({
    assessment_id: z.string().uuid().optional().nullable(),
    reported_by: z.string().uuid().optional().nullable(),
    evidence_notes: z.string().max(20000).optional().nullable(),
    decision: z.string().max(20000).optional().nullable(),
    status: integrityCaseStatusEnum.optional(),
  })
  .strict();

const patchIntegrityCaseStatusBodySchema = z
  .object({
    status: integrityCaseStatusEnum,
  })
  .strict();

module.exports = {
  uuidParamSchema,
  listIntegrityCasesQuerySchema,
  createIntegrityCaseBodySchema,
  updateIntegrityCaseBodySchema,
  patchIntegrityCaseStatusBodySchema,
};
