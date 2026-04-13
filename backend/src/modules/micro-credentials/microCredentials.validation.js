const { z } = require('zod');

const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid micro-credential id'),
});

const microCredentialIdParamSchema = z.object({
  microCredentialId: z.string().uuid('Invalid micro-credential id'),
});

const deliveryModeEnum = z.enum(['online', 'onsite', 'hybrid', 'self_paced']);
const internalApprovalEnum = z.enum(['not_started', 'in_review', 'approved', 'rejected']);
const microCredentialStatusEnum = z.enum(['draft', 'under_review', 'approved', 'active', 'archived']);

const listMicroCredentialsQuerySchema = z
  .object({
    track_id: z.string().uuid().optional(),
    status: microCredentialStatusEnum.optional(),
    internal_approval_status: internalApprovalEnum.optional(),
    search: z.string().max(255).optional(),
  })
  .strict()
  .transform((q) => ({
    track_id: q.track_id,
    status: q.status,
    internal_approval_status: q.internal_approval_status,
    search: q.search?.trim() || undefined,
  }));

const createMicroCredentialBodySchema = z
  .object({
    track_id: z.string().uuid('Invalid track'),
    title: z.string().min(1, 'Title is required').max(255),
    code: z.string().min(1, 'Code is required').max(100),
    description: z.string().max(10000).optional().nullable(),
    level: z.string().min(1, 'Level is required').max(100),
    duration_hours: z.coerce.number().min(0.01, 'Duration must be greater than 0').max(10000),
    delivery_mode: deliveryModeEnum,
    prerequisites: z.string().max(10000).optional().nullable(),
    passing_policy: z.string().max(10000).optional().nullable(),
    attendance_policy: z.string().max(10000).optional().nullable(),
    internal_approval_status: internalApprovalEnum.optional(),
    status: microCredentialStatusEnum.optional(),
    university_ids: z.array(z.string().uuid()).optional(),
  })
  .strict()
  .transform((b) => ({
    track_id: b.track_id,
    title: b.title.trim(),
    code: b.code.trim().toUpperCase(),
    description: b.description === null || b.description === '' ? null : b.description?.trim(),
    level: b.level.trim(),
    duration_hours: b.duration_hours,
    delivery_mode: b.delivery_mode,
    prerequisites: b.prerequisites === null || b.prerequisites === '' ? null : b.prerequisites?.trim(),
    passing_policy: b.passing_policy === null || b.passing_policy === '' ? null : b.passing_policy?.trim(),
    attendance_policy: b.attendance_policy === null || b.attendance_policy === '' ? null : b.attendance_policy?.trim(),
    internal_approval_status: b.internal_approval_status ?? 'not_started',
    status: b.status ?? 'draft',
    university_ids: b.university_ids ? [...new Set(b.university_ids)] : [],
  }));

const updateMicroCredentialBodySchema = z
  .object({
    track_id: z.string().uuid().optional(),
    title: z.string().min(1).max(255).optional(),
    code: z.string().min(1).max(100).optional(),
    description: z.string().max(10000).optional().nullable(),
    level: z.string().min(1).max(100).optional(),
    duration_hours: z.coerce.number().min(0.01).max(10000).optional(),
    delivery_mode: deliveryModeEnum.optional(),
    prerequisites: z.string().max(10000).optional().nullable(),
    passing_policy: z.string().max(10000).optional().nullable(),
    attendance_policy: z.string().max(10000).optional().nullable(),
    internal_approval_status: internalApprovalEnum.optional(),
    status: microCredentialStatusEnum.optional(),
    university_ids: z.array(z.string().uuid()).optional(),
  })
  .strict()
  .refine(
    (b) =>
      b.track_id !== undefined ||
      b.title !== undefined ||
      b.code !== undefined ||
      b.description !== undefined ||
      b.level !== undefined ||
      b.duration_hours !== undefined ||
      b.delivery_mode !== undefined ||
      b.prerequisites !== undefined ||
      b.passing_policy !== undefined ||
      b.attendance_policy !== undefined ||
      b.internal_approval_status !== undefined ||
      b.status !== undefined ||
      b.university_ids !== undefined,
    { message: 'At least one field is required' }
  )
  .transform((b) => ({
    track_id: b.track_id,
    title: b.title?.trim(),
    code: b.code?.trim().toUpperCase(),
    description: b.description === null || b.description === '' ? null : b.description === undefined ? undefined : b.description.trim(),
    level: b.level?.trim(),
    duration_hours: b.duration_hours,
    delivery_mode: b.delivery_mode,
    prerequisites:
      b.prerequisites === null || b.prerequisites === ''
        ? null
        : b.prerequisites === undefined
          ? undefined
          : b.prerequisites.trim(),
    passing_policy:
      b.passing_policy === null || b.passing_policy === ''
        ? null
        : b.passing_policy === undefined
          ? undefined
          : b.passing_policy.trim(),
    attendance_policy:
      b.attendance_policy === null || b.attendance_policy === ''
        ? null
        : b.attendance_policy === undefined
          ? undefined
          : b.attendance_policy.trim(),
    internal_approval_status: b.internal_approval_status,
    status: b.status,
    university_ids: b.university_ids ? [...new Set(b.university_ids)] : undefined,
  }));

const patchMicroCredentialStatusBodySchema = z
  .object({
    status: microCredentialStatusEnum,
  })
  .strict();

module.exports = {
  uuidParamSchema,
  microCredentialIdParamSchema,
  listMicroCredentialsQuerySchema,
  createMicroCredentialBodySchema,
  updateMicroCredentialBodySchema,
  patchMicroCredentialStatusBodySchema,
};
