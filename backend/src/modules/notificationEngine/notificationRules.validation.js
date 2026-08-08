'use strict';

const { z } = require('zod');
const { paginationQueryShape, normalizePagination } = require('../../utils/pagination');
const {
  CATEGORIES,
  PRIORITIES,
  CHANNELS,
  NOTIFICATION_EVENTS,
} = require('./notificationEvents.catalog');
const { OFFICIAL_ROLES } = require('./notificationEngine.shared');

const uuidParamSchema = z.object({
  id: z.string().uuid('معرّف غير صالح'),
});

const officialRoleEnum = z.enum(/** @type {[string, ...string[]]} */ ([...OFFICIAL_ROLES]));
const eventTypeEnum = z.enum(/** @type {[string, ...string[]]} */ ([...NOTIFICATION_EVENTS]));
const categoryEnum = z.enum(/** @type {[string, ...string[]]} */ ([...CATEGORIES]));
const priorityEnum = z.enum(/** @type {[string, ...string[]]} */ ([...PRIORITIES]));
const channelEnum = z.enum(/** @type {[string, ...string[]]} */ ([...CHANNELS]));
const ruleStatusEnum = z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']);
const templateStatusEnum = z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']);
const aggregationEnum = z.enum([
  'NONE',
  'PER_ENTITY',
  'HOURLY_DIGEST',
  'DAILY_DIGEST',
  'WEEKLY_DIGEST',
]);

const listRulesQuerySchema = z
  .object({
    event_type: eventTypeEnum.optional(),
    status: ruleStatusEnum.optional(),
    category: categoryEnum.optional(),
    q: z.string().trim().max(200).optional(),
    ...paginationQueryShape,
  })
  .strict()
  .transform((q) => {
    const p = normalizePagination(q);
    return {
      event_type: q.event_type,
      status: q.status,
      category: q.category,
      q: q.q,
      page: p.page,
      page_size: p.page_size,
      skip: p.skip,
      take: p.take,
    };
  });

const createRuleBodySchema = z
  .object({
    name_ar: z.string().trim().min(2).max(255),
    event_type: eventTypeEnum,
    category: categoryEnum.optional(),
    priority: priorityEnum.optional(),
    target_roles: z.array(officialRoleEnum).default([]),
    /** API-facing; persisted as target_scope.university_ids */
    target_university_ids: z.array(z.string().uuid()).default([]),
    channels: z.array(channelEnum).min(1).default(['IN_APP', 'NOTIFICATION_CENTER', 'BELL']),
    is_critical: z.boolean().optional(),
    requires_acknowledgement: z.boolean().optional(),
    is_immediate: z.boolean().optional(),
    aggregation_mode: aggregationEnum.optional(),
    user_can_disable: z.boolean().optional(),
    delay_seconds: z.coerce.number().int().min(0).max(86400 * 30).optional(),
    extra_conditions: z.record(z.unknown()).optional().nullable(),
    status: ruleStatusEnum.optional(),
  })
  .strict();

const updateRuleBodySchema = createRuleBodySchema.partial().strict();

const createTemplateBodySchema = z
  .object({
    rule_id: z.string().uuid(),
    role_code: officialRoleEnum,
    channel: channelEnum.default('IN_APP'),
    title_template: z.string().trim().min(1).max(500),
    body_template: z.string().trim().min(1).max(10000),
    action_label_template: z.string().trim().max(120).optional().nullable(),
    action_url_template: z.string().trim().max(1000).optional().nullable(),
    locale: z.string().trim().max(10).default('ar'),
    status: templateStatusEnum.optional(),
  })
  .strict();

const updateTemplateBodySchema = createTemplateBodySchema
  .omit({ rule_id: true })
  .partial()
  .strict();

const previewTemplateBodySchema = z
  .object({
    title_template: z.string().trim().min(1).max(500),
    body_template: z.string().trim().min(1).max(10000),
    action_label_template: z.string().trim().max(120).optional().nullable(),
    action_url_template: z.string().trim().max(1000).optional().nullable(),
    vars: z.record(z.unknown()).default({}),
  })
  .strict();

const listDeliveriesQuerySchema = z
  .object({
    status: z
      .enum([
        'PENDING',
        'PROCESSING',
        'SENT',
        'DELIVERED',
        'READ',
        'FAILED',
        'CANCELLED',
        'SKIPPED',
      ])
      .optional(),
    channel: channelEnum.optional(),
    event_type: eventTypeEnum.optional(),
    failures_only: z.enum(['true', 'false']).optional(),
    ...paginationQueryShape,
  })
  .strict()
  .transform((q) => {
    const p = normalizePagination(q);
    return {
      status: q.status,
      channel: q.channel,
      event_type: q.event_type,
      failures_only: q.failures_only === 'true',
      page: p.page,
      page_size: p.page_size,
      skip: p.skip,
      take: p.take,
    };
  });

const analyticsQuerySchema = z
  .object({
    university_id: z.string().uuid().optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    event_type: eventTypeEnum.optional(),
    category: categoryEnum.optional(),
  })
  .strict();

const manualSendBodySchema = z
  .object({
    event_type: eventTypeEnum,
    title: z.string().trim().min(1).max(255),
    body: z.string().trim().max(5000).optional().nullable(),
    action_url: z.string().trim().max(2000).optional().nullable(),
    action_label: z.string().trim().max(120).optional().nullable(),
    university_id: z.string().uuid().optional().nullable(),
    opportunity_id: z.string().uuid().optional().nullable(),
    student_id: z.string().uuid().optional().nullable(),
    instructor_id: z.string().uuid().optional().nullable(),
    target_roles: z.array(officialRoleEnum).optional(),
    dry_run: z.boolean().optional(),
    vars: z.record(z.unknown()).optional(),
  })
  .strict();

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
  listRulesQuerySchema,
  createRuleBodySchema,
  updateRuleBodySchema,
  createTemplateBodySchema,
  updateTemplateBodySchema,
  previewTemplateBodySchema,
  listDeliveriesQuerySchema,
  analyticsQuerySchema,
  manualSendBodySchema,
  preferencesBodySchema,
  eventTypeEnum,
  categoryEnum,
  channelEnum,
  officialRoleEnum,
};
