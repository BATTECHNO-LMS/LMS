const { z } = require('zod');
const { paginationQueryShape, normalizePagination } = require('../../utils/pagination');

const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

const listAuditLogsQuerySchema = z
  .object({
    user_id: z.string().uuid().optional(),
    university_id: z.string().uuid().optional(),
    action_type: z.string().max(120).optional(),
    entity_type: z.string().max(120).optional(),
    from: z.string().max(40).optional(),
    to: z.string().max(40).optional(),
    search: z.string().max(255).optional(),
    ...paginationQueryShape,
  })
  .strict()
  .transform((q) => {
    let fromDate;
    let toDate;
    if (q.from) {
      const d = new Date(q.from);
      if (!Number.isNaN(d.getTime())) fromDate = d;
    }
    if (q.to) {
      const d = new Date(q.to);
      if (!Number.isNaN(d.getTime())) toDate = d;
    }
    const p = normalizePagination(q);
    return {
      user_id: q.user_id,
      university_id: q.university_id,
      action_type: q.action_type?.trim() || undefined,
      entity_type: q.entity_type?.trim() || undefined,
      from: fromDate,
      to: toDate,
      search: q.search?.trim() || undefined,
      page: p.page,
      page_size: p.page_size,
      skip: p.skip,
      take: p.take,
    };
  });

module.exports = {
  uuidParamSchema,
  listAuditLogsQuerySchema,
};
