const { z } = require('zod');

const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

const submissionTypeEnum = z.enum(['file', 'repo_url', 'text_response', 'mixed']);
const submissionStatusEnum = z.enum(['draft', 'submitted', 'late', 'resubmitted', 'graded', 'returned']);

const listSubmissionsQuerySchema = z
  .object({
    assessment_id: z.string().uuid().optional(),
    student_id: z.string().uuid().optional(),
    status: submissionStatusEnum.optional(),
    search: z.string().max(255).optional(),
  })
  .strict()
  .transform((q) => ({
    assessment_id: q.assessment_id,
    student_id: q.student_id,
    status: q.status,
    search: q.search?.trim() || undefined,
  }));

const createSubmissionBodySchema = z
  .object({
    submission_type: submissionTypeEnum,
    file_url: z.string().max(2000).optional().nullable(),
    repo_url: z.string().max(2000).optional().nullable(),
    text_response: z.string().max(50000).optional().nullable(),
  })
  .strict();

const updateSubmissionBodySchema = z
  .object({
    submission_type: submissionTypeEnum.optional(),
    file_url: z.string().max(2000).optional().nullable(),
    repo_url: z.string().max(2000).optional().nullable(),
    text_response: z.string().max(50000).optional().nullable(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: 'At least one field is required' });

const studentIdParamSchema = z.object({
  studentId: z.string().uuid('Invalid student id'),
});

module.exports = {
  uuidParamSchema,
  listSubmissionsQuerySchema,
  createSubmissionBodySchema,
  updateSubmissionBodySchema,
  studentIdParamSchema,
};
