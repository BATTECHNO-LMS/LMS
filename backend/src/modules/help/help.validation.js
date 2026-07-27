'use strict';

const { z } = require('zod');

const onboardingProgressBodySchema = z.object({
  last_step: z.coerce.number().int().min(0).max(20).optional(),
  step: z.coerce.number().int().min(0).max(20).optional(),
});

const supportTicketBodySchema = z.object({
  category: z.enum([
    'ACCOUNT',
    'EMAIL_VERIFICATION',
    'PROFILE',
    'OPPORTUNITY',
    'APPLICATION',
    'SESSION',
    'ATTENDANCE',
    'ZOOM_LINK',
    'PRE_TEST',
    'POST_TEST',
    'TASK',
    'SUBMISSION',
    'AI_EVALUATION',
    'PROGRESS',
    'TRAINING_HOURS',
    'CERTIFICATE',
    'TECHNICAL',
    'OTHER',
  ]),
  title: z.string().trim().min(3).max(255),
  description: z.string().trim().min(10).max(5000),
  opportunity_id: z.string().uuid().optional().nullable(),
  session_id: z.string().uuid().optional().nullable(),
  task_id: z.string().uuid().optional().nullable(),
  assessment_id: z.string().uuid().optional().nullable(),
  browser_info: z.string().max(500).optional().nullable(),
  device_info: z.string().max(500).optional().nullable(),
  attachment_file_id: z.string().uuid().optional().nullable(),
});

const helpSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const contextualHelpQuerySchema = z.object({
  route: z.string().trim().min(1).max(255).optional(),
  key: z.string().trim().min(1).max(100).optional(),
});

const slugParamSchema = z.object({
  slug: z.string().trim().min(1).max(200),
});

const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

const adminCategoryBodySchema = z.object({
  title_ar: z.string().trim().min(2).max(255),
  title_en: z.string().trim().max(255).optional().nullable(),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description_ar: z.string().max(5000).optional().nullable(),
  description_en: z.string().max(5000).optional().nullable(),
  icon: z.string().max(64).optional().nullable(),
  sort_order: z.coerce.number().int().min(0).max(10000).optional(),
  is_active: z.coerce.boolean().optional(),
  target_roles: z.array(z.string().trim().min(1).max(50)).optional(),
});

const adminArticleBodySchema = z.object({
  category_id: z.string().uuid(),
  title_ar: z.string().trim().min(2).max(500),
  title_en: z.string().trim().max(500).optional().nullable(),
  slug: z.string().trim().min(2).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  summary_ar: z.string().max(2000).optional().nullable(),
  summary_en: z.string().max(2000).optional().nullable(),
  content_ar: z.string().trim().min(10).max(50000),
  content_en: z.string().max(50000).optional().nullable(),
  keywords: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
  sort_order: z.coerce.number().int().min(0).max(10000).optional(),
  is_published: z.coerce.boolean().optional(),
  target_roles: z.array(z.string().trim().min(1).max(50)).optional(),
  related_route: z.string().max(255).optional().nullable(),
  contextual_key: z.string().max(100).optional().nullable(),
  guide_version: z.string().max(100).optional().nullable(),
  is_faq: z.coerce.boolean().optional(),
});

const reorderBodySchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        sort_order: z.coerce.number().int().min(0).max(10000),
      })
    )
    .min(1),
});

module.exports = {
  onboardingProgressBodySchema,
  supportTicketBodySchema,
  helpSearchQuerySchema,
  contextualHelpQuerySchema,
  slugParamSchema,
  uuidParamSchema,
  adminCategoryBodySchema,
  adminArticleBodySchema,
  reorderBodySchema,
};
