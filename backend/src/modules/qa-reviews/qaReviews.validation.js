const { z } = require('zod');
const { paginationQueryShape, normalizePagination } = require('../../utils/pagination');

const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

const qaReviewStatusEnum = z.enum(['open', 'in_progress', 'resolved', 'closed']);
const reviewTypeEnum = z.enum(['scheduled', 'periodic', 'pre_closure', 'special']);

const listQaReviewsQuerySchema = z
  .object({
    cohort_id: z.string().uuid().optional(),
    reviewer_id: z.string().uuid().optional(),
    review_type: reviewTypeEnum.optional(),
    status: qaReviewStatusEnum.optional(),
    search: z.string().max(255).optional(),
    ...paginationQueryShape,
  })
  .strict()
  .transform((q) => {
    const p = normalizePagination(q);
    return {
      cohort_id: q.cohort_id,
      reviewer_id: q.reviewer_id,
      review_type: q.review_type,
      status: q.status,
      search: q.search?.trim() || undefined,
      page: p.page,
      page_size: p.page_size,
      skip: p.skip,
      take: p.take,
    };
  });

const getQaReviewQuerySchema = z
  .object({
    include_corrective: z.enum(['true', 'false']).optional(),
  })
  .strict()
  .transform((q) => ({
    include_corrective: q.include_corrective === 'true',
  }));

const createQaReviewBodySchema = z
  .object({
    cohort_id: z.string().uuid(),
    review_date: z.string().min(1).max(40),
    review_type: reviewTypeEnum,
    reviewer_id: z.string().uuid().optional().nullable(),
    findings: z.string().max(20000).optional().nullable(),
    action_required: z.string().max(20000).optional().nullable(),
  })
  .strict();

const updateQaReviewBodySchema = z
  .object({
    review_date: z.string().min(1).max(40).optional(),
    review_type: reviewTypeEnum.optional(),
    reviewer_id: z.string().uuid().optional().nullable(),
    findings: z.string().max(20000).optional().nullable(),
    action_required: z.string().max(20000).optional().nullable(),
    status: qaReviewStatusEnum.optional(),
  })
  .strict();

const patchQaReviewStatusBodySchema = z
  .object({
    status: qaReviewStatusEnum,
  })
  .strict();

module.exports = {
  uuidParamSchema,
  listQaReviewsQuerySchema,
  getQaReviewQuerySchema,
  createQaReviewBodySchema,
  updateQaReviewBodySchema,
  patchQaReviewStatusBodySchema,
  qaReviewStatusEnum,
};
