'use strict';

const { z } = require('zod');
const { paginationQueryShape, normalizePagination } = require('../../utils/pagination');
const { OFFICIAL_ROLES } = require('../contentCms/contentCms.shared');

const announcementTypeEnum = z.enum([
  'INFORMATION',
  'SUCCESS',
  'WARNING',
  'IMPORTANT',
  'URGENT',
  'MAINTENANCE',
]);

const announcementStatusEnum = z.enum([
  'DRAFT',
  'SCHEDULED',
  'PUBLISHED',
  'PAUSED',
  'EXPIRED',
  'ARCHIVED',
]);

const channelCodeEnum = z.enum([
  'TOP_BANNER',
  'DASHBOARD_CARD',
  'POPUP',
  'NOTIFICATION_CENTER',
  'IN_APP_NOTIFICATION',
  'CONTEXTUAL_BLOCK',
  'EMAIL',
  'PUSH_NOTIFICATION',
  'SMS',
]);

const targetTypeEnum = z.enum([
  'ALL_USERS',
  'ROLE',
  'UNIVERSITY',
  'SPECIALTY',
  'OPPORTUNITY',
  'SESSION',
  'USER',
  'ACCOUNT_STATUS',
  'APPLICATION_STATUS',
  'ACTIVATION_STATUS',
  'ONBOARDING_STATUS',
  'PROGRESS_RANGE',
  'CERTIFICATE_STATUS',
]);

const officialRoleEnum = z.enum(
  /** @type {[string, ...string[]]} */ ([...OFFICIAL_ROLES])
);

const uuidParamSchema = z.object({
  id: z.string().uuid('معرّف غير صالح'),
});

const nullableUuid = z.string().uuid().optional().nullable();
const nullableString = (max) => z.string().trim().max(max).optional().nullable();

const optimisticVersionField = z.coerce.number().int().min(1).optional();

const optimisticUpdatedAtField = z
  .union([z.string().datetime({ offset: true }), z.string().datetime(), z.coerce.date()])
  .optional()
  .transform((v) => {
    if (v == null) return undefined;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d;
  });

const targetRowSchema = z
  .object({
    target_type: targetTypeEnum,
    role_code: officialRoleEnum.optional().nullable(),
    university_id: nullableUuid,
    specialization_id: nullableUuid,
    opportunity_id: nullableUuid,
    session_id: nullableUuid,
    user_id: nullableUuid,
    account_status: z
      .enum(['active', 'inactive', 'suspended', 'rejected'])
      .optional()
      .nullable(),
    application_status: z.string().trim().max(50).optional().nullable(),
    activation_status: z.string().trim().max(50).optional().nullable(),
    onboarding_status: z.string().trim().max(50).optional().nullable(),
    progress_min: z.coerce.number().int().min(0).max(100).optional().nullable(),
    progress_max: z.coerce.number().int().min(0).max(100).optional().nullable(),
    certificate_status: z.string().trim().max(50).optional().nullable(),
  })
  .superRefine((row, ctx) => {
    switch (row.target_type) {
      case 'ROLE':
        if (!row.role_code) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'يرجى تحديد الدور المستهدف',
            path: ['role_code'],
          });
        }
        break;
      case 'UNIVERSITY':
        if (!row.university_id) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'يرجى تحديد الجامعة المستهدفة',
            path: ['university_id'],
          });
        }
        break;
      case 'SPECIALTY':
        if (!row.specialization_id) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'يرجى تحديد التخصص المستهدف',
            path: ['specialization_id'],
          });
        }
        break;
      case 'OPPORTUNITY':
        if (!row.opportunity_id) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'يرجى تحديد الفرصة المستهدفة',
            path: ['opportunity_id'],
          });
        }
        break;
      case 'SESSION':
        if (!row.session_id) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'يرجى تحديد الجلسة المستهدفة',
            path: ['session_id'],
          });
        }
        break;
      case 'USER':
        if (!row.user_id) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'يرجى تحديد المستخدم المستهدف',
            path: ['user_id'],
          });
        }
        break;
      case 'ACCOUNT_STATUS':
        if (!row.account_status) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'يرجى تحديد حالة الحساب المستهدفة',
            path: ['account_status'],
          });
        }
        break;
      case 'APPLICATION_STATUS':
        if (!row.application_status) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'يرجى تحديد حالة الطلب المستهدفة',
            path: ['application_status'],
          });
        }
        break;
      case 'ACTIVATION_STATUS':
        if (!row.activation_status) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'يرجى تحديد حالة التفعيل المستهدفة',
            path: ['activation_status'],
          });
        }
        break;
      case 'ONBOARDING_STATUS':
        if (!row.onboarding_status) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'يرجى تحديد حالة الإعداد المستهدفة',
            path: ['onboarding_status'],
          });
        }
        break;
      case 'PROGRESS_RANGE':
        if (row.progress_min == null && row.progress_max == null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'يرجى تحديد نطاق التقدم المستهدف',
            path: ['progress_min'],
          });
        } else if (
          row.progress_min != null &&
          row.progress_max != null &&
          row.progress_max < row.progress_min
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'الحد الأعلى للتقدم يجب أن يكون أكبر من أو يساوي الحد الأدنى',
            path: ['progress_max'],
          });
        }
        break;
      case 'CERTIFICATE_STATUS':
        if (!row.certificate_status) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'يرجى تحديد حالة الشهادة المستهدفة',
            path: ['certificate_status'],
          });
        }
        break;
      case 'ALL_USERS':
      default:
        break;
    }
  });

const channelRowSchema = z.object({
  channel_code: channelCodeEnum,
  is_enabled: z.coerce.boolean().optional().default(true),
});

const dateTimeField = z
  .union([z.string().datetime({ offset: true }), z.string().datetime(), z.coerce.date()])
  .optional()
  .nullable()
  .transform((v) => {
    if (v == null || v === '') return null;
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  });

const announcementBodyBase = {
  admin_name: z.string().trim().min(2, 'يرجى إدخال الاسم الإداري').max(255),
  title_ar: z.string().trim().min(2, 'يرجى إدخال عنوان الإعلان').max(500),
  summary_ar: z.string().max(5000).optional().nullable(),
  content_ar: z.string().trim().min(1, 'يرجى إدخال محتوى الإعلان').max(100000),
  icon: nullableString(64),
  image_url: nullableString(1000),
  announcement_type: announcementTypeEnum.optional().default('INFORMATION'),
  priority: z.coerce.number().int().min(0).max(100000).optional().default(100),
  starts_at: dateTimeField,
  ends_at: dateTimeField,
  timezone: z.string().trim().min(1).max(64).optional().default('Asia/Amman'),
  is_dismissible: z.coerce.boolean().optional().default(true),
  requires_acknowledgement: z.coerce.boolean().optional().default(false),
  blocks_usage: z.coerce.boolean().optional().default(false),
  is_pinned: z.coerce.boolean().optional().default(false),
  max_impressions: z.coerce.number().int().min(1).max(100000).optional().nullable(),
  cta_label: nullableString(120),
  cta_url: nullableString(1000),
  trigger_event: nullableString(100),
  targets: z.array(targetRowSchema).min(1, 'يرجى تحديد جمهور واحد على الأقل').max(50),
  channels: z.array(channelRowSchema).min(1, 'يرجى تحديد قناة عرض واحدة على الأقل').max(20),
};

function refineScheduleWindow(data, ctx) {
  if (data.starts_at && data.ends_at && data.ends_at.getTime() <= data.starts_at.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'يجب أن يكون تاريخ النهاية بعد تاريخ البداية',
      path: ['ends_at'],
    });
  }
}

const createAnnouncementBodySchema = z
  .object(announcementBodyBase)
  .superRefine(refineScheduleWindow);

const updateAnnouncementBodySchema = z
  .object({
    ...Object.fromEntries(
      Object.entries(announcementBodyBase).map(([key, schema]) => [key, schema.optional()])
    ),
    targets: z.array(targetRowSchema).min(1, 'يرجى تحديد جمهور واحد على الأقل').max(50).optional(),
    channels: z
      .array(channelRowSchema)
      .min(1, 'يرجى تحديد قناة عرض واحدة على الأقل')
      .max(20)
      .optional(),
    version: optimisticVersionField,
    updated_at: optimisticUpdatedAtField,
  })
  .superRefine(refineScheduleWindow);

const scheduleBodySchema = z
  .object({
    starts_at: dateTimeField.refine((v) => v != null, { message: 'يرجى تحديد تاريخ بداية العرض' }),
    ends_at: dateTimeField,
    timezone: z.string().trim().min(1).max(64).optional(),
    version: optimisticVersionField,
    updated_at: optimisticUpdatedAtField,
  })
  .superRefine(refineScheduleWindow);

const listAnnouncementsQuerySchema = z
  .object({
    status: announcementStatusEnum.optional(),
    q: z.string().trim().max(200).optional(),
    ...paginationQueryShape,
  })
  .transform((q) => {
    const p = normalizePagination(q);
    return {
      status: q.status,
      q: q.q || undefined,
      page: p.page,
      page_size: p.page_size,
      skip: p.skip,
      take: p.take,
    };
  });

const userActionBodySchema = z.object({
  channel: channelCodeEnum.optional().nullable(),
});

const optimisticLockBodySchema = z.object({
  version: optimisticVersionField,
  updated_at: optimisticUpdatedAtField,
});

module.exports = {
  uuidParamSchema,
  createAnnouncementBodySchema,
  updateAnnouncementBodySchema,
  scheduleBodySchema,
  listAnnouncementsQuerySchema,
  userActionBodySchema,
  optimisticLockBodySchema,
  announcementTypeEnum,
  announcementStatusEnum,
  channelCodeEnum,
  targetTypeEnum,
};
