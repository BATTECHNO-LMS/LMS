const { z } = require('zod');

const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

const notificationTypeEnum = z.enum(['info', 'success', 'warning', 'danger', 'system']);

const listNotificationsQuerySchema = z
  .object({
    is_read: z.enum(['true', 'false']).optional(),
    type: notificationTypeEnum.optional(),
  })
  .strict()
  .transform((q) => ({
    is_read: q.is_read === 'true' ? true : q.is_read === 'false' ? false : undefined,
    type: q.type,
  }));

module.exports = {
  uuidParamSchema,
  listNotificationsQuerySchema,
  notificationTypeEnum,
};
