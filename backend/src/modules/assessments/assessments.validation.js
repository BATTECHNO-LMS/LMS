const { z } = require('zod');
const { paginationQueryShape, normalizePagination } = require('../../utils/pagination');

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
    ...paginationQueryShape,
  })
  .strict()
  .transform((q) => {
    const p = normalizePagination(q);
    return {
      cohort_id: q.cohort_id,
      micro_credential_id: q.micro_credential_id,
      assessment_type: q.assessment_type,
      status: q.status,
      linked_outcome_id: q.linked_outcome_id,
      search: q.search?.trim() || undefined,
      page: p.page,
      page_size: p.page_size,
      skip: p.skip,
      take: p.take,
    };
  });

const submissionPreferenceEnum = z.enum(['file', 'repo_url', 'text_response', 'mixed']);

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
    time_limit_minutes: z
      .preprocess(
        (v) => (v === '' || v === undefined ? undefined : v === null ? null : Number(v)),
        z.number().int().min(1).max(10080).nullable().optional()
      ),
    max_attempts: z.preprocess(
      (v) => (v === '' || v === undefined ? undefined : Number(v)),
      z.coerce.number().int().min(1).max(50).optional()
    ),
    shuffle_questions: z.boolean().optional(),
    question_bank_ref: z.string().trim().max(255).optional().nullable(),
    preferred_submission_type: submissionPreferenceEnum.optional().nullable(),
  })
  .strict()
  .transform((b) => ({
    ...b,
    title: b.title.trim(),
    due_date: b.due_date,
    open_at: b.open_at ?? undefined,
    question_bank_ref: b.question_bank_ref && b.question_bank_ref.length ? b.question_bank_ref : null,
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
    time_limit_minutes: z
      .preprocess(
        (v) => (v === '' || v === undefined ? undefined : v === null ? null : Number(v)),
        z.number().int().min(1).max(10080).nullable().optional()
      ),
    max_attempts: z.preprocess(
      (v) => (v === '' || v === undefined ? undefined : Number(v)),
      z.coerce.number().int().min(1).max(50).optional()
    ),
    shuffle_questions: z.boolean().optional(),
    question_bank_ref: z.string().trim().max(255).optional().nullable(),
    preferred_submission_type: submissionPreferenceEnum.optional().nullable(),
  })
  .strict()
  .transform((b) => ({
    ...b,
    ...(b.title !== undefined ? { title: b.title.trim() } : {}),
    ...(b.question_bank_ref !== undefined
      ? { question_bank_ref: b.question_bank_ref && b.question_bank_ref.length ? b.question_bank_ref : null }
      : {}),
  }))
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
