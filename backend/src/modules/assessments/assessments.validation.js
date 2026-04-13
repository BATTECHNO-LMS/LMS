const { z } = require('zod');

const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

const assessmentStatusEnum = z.enum(['draft', 'published', 'open', 'closed', 'archived']);
const assessmentTypeEnum = z.enum([
  'quiz',
  'assignment',
  'lab',
  'practical_exam',
  'milestone',
  'capstone_project',
  'presentation',
]);

const listAssessmentsQuerySchema = z
  .object({
    cohort_id: z.string().uuid().optional(),
    micro_credential_id: z.string().uuid().optional(),
    assessment_type: assessmentTypeEnum.optional(),
    status: assessmentStatusEnum.optional(),
    linked_outcome_id: z.string().uuid().optional(),
    search: z.string().max(255).optional(),
  })
  .strict()
  .transform((q) => ({
    cohort_id: q.cohort_id,
    micro_credential_id: q.micro_credential_id,
    assessment_type: q.assessment_type,
    status: q.status,
    linked_outcome_id: q.linked_outcome_id,
    search: q.search?.trim() || undefined,
  }));

const createAssessmentBodySchema = z
  .object({
    cohort_id: z.string().uuid(),
    micro_credential_id: z.string().uuid(),
    title: z.string().min(1).max(255),
    assessment_type: assessmentTypeEnum,
    weight: z.coerce.number().gt(0).max(100),
    open_at: z.string().max(40).optional().nullable(),
    due_date: z.string().min(1).max(40),
    linked_outcome_id: z.string().uuid().optional().nullable(),
    rubric_id: z.string().uuid().optional().nullable(),
    instructions: z.string().max(20000).optional().nullable(),
    status: assessmentStatusEnum.optional(),
  })
  .strict()
  .transform((b) => ({
    ...b,
    title: b.title.trim(),
    due_date: b.due_date,
    open_at: b.open_at ?? undefined,
  }));

const updateAssessmentBodySchema = z
  .object({
    cohort_id: z.string().uuid().optional(),
    micro_credential_id: z.string().uuid().optional(),
    title: z.string().min(1).max(255).optional(),
    assessment_type: assessmentTypeEnum.optional(),
    weight: z.coerce.number().gt(0).max(100).optional(),
    open_at: z.string().max(40).optional().nullable(),
    due_date: z.string().max(40).optional(),
    linked_outcome_id: z.string().uuid().optional().nullable(),
    rubric_id: z.string().uuid().optional().nullable(),
    instructions: z.string().max(20000).optional().nullable(),
    status: assessmentStatusEnum.optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: 'At least one field is required' });

const patchAssessmentStatusBodySchema = z
  .object({
    status: assessmentStatusEnum,
  })
  .strict();

module.exports = {
  uuidParamSchema,
  listAssessmentsQuerySchema,
  createAssessmentBodySchema,
  updateAssessmentBodySchema,
  patchAssessmentStatusBodySchema,
  assessmentStatusEnum,
  assessmentTypeEnum,
};
