const { z } = require('zod');
const { paginationQueryShape, normalizePagination } = require('../../utils/pagination');
const { CATEGORIES, CHANNELS } = require('../notificationEngine/notificationEvents.catalog');

const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

const notificationTypeEnum = z.enum([
  'info',
  'success',
  'warning',
  'danger',
  'system',
  'user_pending_activation',
  'action_required',
]);

const categoryEnum = z.enum(/** @type {[string, ...string[]]} */ ([...CATEGORIES]));
const channelEnum = z.enum(/** @type {[string, ...string[]]} */ ([...CHANNELS]));

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

const preferencesBodySchema = z
  .object({
    preferences: z
      .array(
        z.object({
          notification_category: categoryEnum,
          channel: channelEnum,
          is_enabled: z.boolean(),
        })
      )
      .min(1)
      .max(100),
  })
  .strict();

module.exports = {
  uuidParamSchema,
  listNotificationsQuerySchema,
  notificationTypeEnum,
  preferencesBodySchema,
  categoryEnum,
  channelEnum,
};
