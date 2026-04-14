const { z } = require('zod');
const { paginationQueryShape, normalizePagination } = require('../../utils/pagination');

const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

const recognitionStatusEnum = z.enum([
  'draft',
  'in_preparation',
  'ready_for_submission',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'needs_revision',
]);

const listRecognitionQuerySchema = z
  .object({
    university_id: z.string().uuid().optional(),
    micro_credential_id: z.string().uuid().optional(),
    cohort_id: z.string().uuid().optional(),
    status: recognitionStatusEnum.optional(),
    search: z.string().max(255).optional(),
    ...paginationQueryShape,
  })
  .strict()
  .transform((q) => {
    const p = normalizePagination(q);
    return {
      university_id: q.university_id,
      micro_credential_id: q.micro_credential_id,
      cohort_id: q.cohort_id,
      status: q.status,
      search: q.search?.trim() || undefined,
      page: p.page,
      page_size: p.page_size,
      skip: p.skip,
      take: p.take,
    };
  });

const createRecognitionBodySchema = z
  .object({
    university_id: z.string().uuid(),
    micro_credential_id: z.string().uuid(),
    cohort_id: z.string().uuid(),
    created_by: z.string().uuid().optional().nullable(),
    status: recognitionStatusEnum.optional(),
    decision_notes: z.string().max(20000).optional().nullable(),
  })
  .strict();

const updateRecognitionBodySchema = z
  .object({
    decision_notes: z.string().max(20000).optional().nullable(),
  })
  .strict();

const patchRecognitionStatusBodySchema = z
  .object({
    status: recognitionStatusEnum,
  })
  .strict();

module.exports = {
  uuidParamSchema,
  listRecognitionQuerySchema,
  createRecognitionBodySchema,
  updateRecognitionBodySchema,
  patchRecognitionStatusBodySchema,
  recognitionStatusEnum,
};
