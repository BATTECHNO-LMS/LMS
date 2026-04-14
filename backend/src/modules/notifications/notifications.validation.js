const { z } = require('zod');
const { paginationQueryShape, normalizePagination } = require('../../utils/pagination');

const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

const notificationTypeEnum = z.enum(['info', 'success', 'warning', 'danger', 'system']);

const listNotificationsQuerySchema = z
  .object({
    is_read: z.enum(['true', 'false']).optional(),
    type: notificationTypeEnum.optional(),
    ...paginationQueryShape,
  })
  .strict()
  .transform((q) => {
    const p = normalizePagination(q);
    return {
      is_read: q.is_read === 'true' ? true : q.is_read === 'false' ? false : undefined,
      type: q.type,
      page: p.page,
      page_size: p.page_size,
      skip: p.skip,
      take: p.take,
    };
  });

module.exports = {
  uuidParamSchema,
  listNotificationsQuerySchema,
  notificationTypeEnum,
};
