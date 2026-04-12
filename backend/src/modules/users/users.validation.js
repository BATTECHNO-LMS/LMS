const { z } = require('zod');

const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid user id'),
});

const userStatusEnum = z.enum(['active', 'inactive', 'suspended']);

const listUsersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(20),
    status: userStatusEnum.optional(),
    university_id: z.string().uuid().optional(),
    search: z.string().max(255).optional(),
  })
  .strict()
  .transform((q) => ({
    page: q.page,
    page_size: q.page_size,
    status: q.status,
    university_id: q.university_id,
    search: q.search?.trim() || undefined,
  }));

const createUserBodySchema = z
  .object({
    full_name: z.string().min(1, 'Full name is required').max(255),
    email: z.string().email('Invalid email').max(255),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    phone: z.string().max(50).optional(),
    status: userStatusEnum.optional(),
    primary_university_id: z.string().uuid().optional(),
    role_codes: z.array(z.string().min(1).max(80)).min(1, 'At least one role is required'),
    university_relationship_type: z.string().min(1).max(100).optional(),
  })
  .strict()
  .transform((b) => ({
    full_name: b.full_name.trim(),
    email: b.email.trim().toLowerCase(),
    password: b.password,
    phone: b.phone?.trim() || undefined,
    status: b.status,
    primary_university_id: b.primary_university_id,
    role_codes: [...new Set(b.role_codes.map((c) => c.trim().toLowerCase()))],
    university_relationship_type: b.university_relationship_type?.trim(),
  }));

const updateUserBodySchema = z
  .object({
    full_name: z.string().min(1).max(255).optional(),
    phone: z.string().max(50).optional().nullable(),
    status: userStatusEnum.optional(),
    primary_university_id: z.string().uuid().optional().nullable(),
    role_codes: z.array(z.string().min(1).max(80)).min(1).optional(),
  })
  .strict()
  .refine(
    (b) =>
      b.full_name !== undefined ||
      b.phone !== undefined ||
      b.status !== undefined ||
      b.primary_university_id !== undefined ||
      b.role_codes !== undefined,
    { message: 'At least one field is required' }
  )
  .transform((b) => ({
    full_name: b.full_name?.trim(),
    phone: b.phone === null ? null : b.phone?.trim(),
    status: b.status,
    primary_university_id: b.primary_university_id,
    role_codes: b.role_codes ? [...new Set(b.role_codes.map((c) => c.trim().toLowerCase()))] : undefined,
  }));

const patchUserStatusBodySchema = z
  .object({
    status: userStatusEnum,
  })
  .strict();

module.exports = {
  uuidParamSchema,
  listUsersQuerySchema,
  createUserBodySchema,
  updateUserBodySchema,
  patchUserStatusBodySchema,
};
