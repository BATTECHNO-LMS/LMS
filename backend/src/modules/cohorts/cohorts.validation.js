const { z } = require('zod');
const { paginationQueryShape, normalizePagination } = require('../../utils/pagination');

const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

const cohortStatusEnum = z.enum([
  'planned',
  'open_for_enrollment',
  'active',
  'completed',
  'closed',
  'cancelled',
]);

const listCohortsQuerySchema = z
  .object({
    status: cohortStatusEnum.optional(),
    university_id: z.string().uuid().optional(),
    micro_credential_id: z.string().uuid().optional(),
    instructor_id: z.string().uuid().optional(),
    search: z.string().max(255).optional(),
    ...paginationQueryShape,
  })
  .strict()
  .transform((q) => {
    const p = normalizePagination(q);
    return {
      status: q.status,
      university_id: q.university_id,
      micro_credential_id: q.micro_credential_id,
      instructor_id: q.instructor_id,
      search: q.search?.trim() || undefined,
      page: p.page,
      page_size: p.page_size,
      skip: p.skip,
      take: p.take,
    };
  });

const createCohortBodySchema = z
  .object({
    title: z.string().min(1, 'Title is required').max(255),
    micro_credential_id: z.string().uuid('micro_credential_id must be a UUID'),
    university_id: z.string().uuid('university_id must be a UUID'),
    instructor_id: z.string().uuid().optional().nullable(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'start_date must be YYYY-MM-DD'),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'end_date must be YYYY-MM-DD'),
    capacity: z.coerce.number().int().min(1, 'capacity must be at least 1'),
    status: cohortStatusEnum.optional(),
  })
  .strict()
  .transform((b) => ({
    ...b,
    title: b.title.trim(),
  }));

const updateCohortBodySchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    micro_credential_id: z.string().uuid().optional(),
    university_id: z.string().uuid().optional(),
    instructor_id: z.string().uuid().optional().nullable(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    capacity: z.coerce.number().int().min(1).optional(),
    status: cohortStatusEnum.optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: 'At least one field is required' });

const patchCohortStatusBodySchema = z
  .object({
    status: cohortStatusEnum,
  })
  .strict();

module.exports = {
  uuidParamSchema,
  listCohortsQuerySchema,
  createCohortBodySchema,
  updateCohortBodySchema,
  patchCohortStatusBodySchema,
  cohortStatusEnum,
};
