'use strict';

const { z } = require('zod');
const { OFFICIAL_ROLES } = require('../contentCms/contentCms.shared');

const OFFICIAL_ROLE_ENUM = z.enum(OFFICIAL_ROLES);

const POPUP_TYPES = ['INFO', 'SUCCESS', 'WARNING', 'IMPORTANT', 'URGENT'];
const DISPLAY_RULES = [
  'ONCE',
  'ONCE_PER_VERSION',
  'EVERY_LOGIN',
  'UNTIL_ACKNOWLEDGED',
  'DATE_RANGE',
  'EVENT_TRIGGERED',
];
const POPUP_STATUSES = ['DRAFT', 'PUBLISHED', 'PAUSED', 'ARCHIVED'];

const uuidParamSchema = z.object({
  id: z.string().uuid('معرّف غير صالح'),
});

const uuidArray = z.array(z.string().uuid('معرّف غير صالح')).default([]);

const optionalDate = z
  .union([z.string().datetime({ offset: true }), z.string().datetime(), z.null()])
  .optional()
  .nullable();

const popupBodyObjectSchema = z.object({
  admin_name: z.string().trim().min(2, 'الاسم الإداري مطلوب').max(255),
  title_ar: z.string().trim().min(2, 'العنوان بالعربية مطلوب').max(500),
  body_ar: z.string().trim().min(1, 'المحتوى بالعربية مطلوب').max(50000),
  icon: z.string().trim().max(64).optional().nullable(),
  image_url: z.string().trim().max(1000).optional().nullable(),
  popup_type: z.enum(POPUP_TYPES).optional().default('INFO'),
  cta_label: z.string().trim().max(120).optional().nullable(),
  cta_url: z.string().trim().max(1000).optional().nullable(),
  is_dismissible: z.boolean().optional().default(true),
  requires_acknowledgement: z.boolean().optional().default(false),
  display_rule: z.enum(DISPLAY_RULES).optional().default('ONCE'),
  target_roles: z.array(OFFICIAL_ROLE_ENUM).optional().default([]),
  target_university_ids: uuidArray.optional(),
  target_specialty_ids: uuidArray.optional(),
  target_opportunity_id: z.string().uuid('معرّف غير صالح').optional().nullable(),
  target_session_id: z.string().uuid('معرّف غير صالح').optional().nullable(),
  target_user_ids: uuidArray.optional(),
  target_pages: z.array(z.string().trim().min(1).max(255)).optional().default([]),
  starts_at: optionalDate,
  ends_at: optionalDate,
  priority: z.coerce.number().int().min(0).max(100000).optional().default(100),
  max_impressions: z.coerce.number().int().min(1).max(100000).optional().nullable(),
  trigger_event: z.string().trim().max(100).optional().nullable(),
});

function refinePopupScheduleAndTrigger(data, ctx) {
  if (data.starts_at && data.ends_at) {
    const start = new Date(data.starts_at);
    const end = new Date(data.ends_at);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end < start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء',
        path: ['ends_at'],
      });
    }
  }
  if (data.display_rule === 'EVENT_TRIGGERED' && !data.trigger_event) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'حدث التشغيل مطلوب عند اختيار قاعدة EVENT_TRIGGERED',
      path: ['trigger_event'],
    });
  }
}

const createPopupBodySchema = popupBodyObjectSchema.superRefine(refinePopupScheduleAndTrigger);

const updatePopupBodySchema = popupBodyObjectSchema
  .partial()
  .superRefine(refinePopupScheduleAndTrigger);

const adminListQuerySchema = z.object({
  status: z.enum(POPUP_STATUSES).optional(),
  popup_type: z.enum(POPUP_TYPES).optional(),
  q: z.string().trim().max(200).optional(),
  system_key: z.string().trim().max(100).optional(),
});

const activePopupsQuerySchema = z.object({
  route: z.string().trim().max(255).optional(),
  trigger_event: z.string().trim().max(100).optional(),
  opportunity_id: z.string().uuid().optional(),
  session_id: z.string().uuid().optional(),
  specialty_id: z.string().uuid().optional(),
});

module.exports = {
  uuidParamSchema,
  createPopupBodySchema,
  updatePopupBodySchema,
  adminListQuerySchema,
  activePopupsQuerySchema,
  POPUP_TYPES,
  DISPLAY_RULES,
  POPUP_STATUSES,
};
