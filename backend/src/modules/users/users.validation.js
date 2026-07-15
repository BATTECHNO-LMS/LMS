const { z } = require('zod');
const { DEFAULT_PAGE_SIZE, ADMIN_MAX_PAGE_SIZE } = require('../../utils/pagination');

const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid user id'),
});

const userStatusEnum = z.enum(['active', 'inactive', 'suspended']);

const listUsersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(ADMIN_MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    status: userStatusEnum.optional(),
    university_id: z.string().uuid().optional(),
    search: z.string().max(255).optional(),
    email_verified: z
      .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0'), z.boolean()])
      .optional(),
  })
  .strict()
  .transform((q) => {
    let emailVerified;
    if (q.email_verified === true || q.email_verified === 'true' || q.email_verified === '1') {
      emailVerified = true;
    } else if (q.email_verified === false || q.email_verified === 'false' || q.email_verified === '0') {
      emailVerified = false;
    }
    return {
      page: q.page,
      page_size: q.page_size,
      status: q.status,
      university_id: q.university_id,
      search: q.search?.trim() || undefined,
      email_verified: emailVerified,
    };
  });

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
    email: z.string().email('Invalid email').max(255).optional(),
    phone: z.string().max(50).optional().nullable(),
    status: userStatusEnum.optional(),
    primary_university_id: z.string().uuid().optional().nullable(),
    university_specialty_id: z.string().uuid().optional().nullable(),
    specialty_id: z.string().uuid().optional().nullable(),
    role_codes: z.array(z.string().min(1).max(80)).min(1).optional(),
  })
  .strict()
  .refine(
    (b) =>
      b.full_name !== undefined ||
      b.email !== undefined ||
      b.phone !== undefined ||
      b.status !== undefined ||
      b.primary_university_id !== undefined ||
      b.university_specialty_id !== undefined ||
      b.specialty_id !== undefined ||
      b.role_codes !== undefined,
    { message: 'At least one field is required' }
  )
  .transform((b) => ({
    full_name: b.full_name?.trim(),
    email: b.email?.trim().toLowerCase(),
    phone: b.phone === null ? null : b.phone?.trim(),
    status: b.status,
    primary_university_id: b.primary_university_id,
    university_specialty_id: b.university_specialty_id,
    specialty_id: b.specialty_id,
    role_codes: b.role_codes ? [...new Set(b.role_codes.map((c) => c.trim().toLowerCase()))] : undefined,
  }));

const adminResetPasswordBodySchema = z
  .object({
    new_password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    confirm_password: z.string().min(8).max(128),
  })
  .strict()
  .refine((b) => b.new_password === b.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

const patchUserStatusBodySchema = z
  .object({
    status: userStatusEnum,
  })
  .strict();

const activatePendingQuerySchema = z
  .object({
    university_id: z.string().uuid().optional(),
  })
  .strict();

const activatePendingBodySchema = z
  .object({
    user_ids: z.array(z.string().uuid()).max(500).optional(),
  })
  .strict();

const verifyAllEmailsQuerySchema = z
  .object({
    university_id: z.string().uuid().optional(),
    status: userStatusEnum.optional(),
  })
  .strict();

const verifyAllEmailsBodySchema = z
  .object({
    user_ids: z.array(z.string().uuid()).max(1000).optional(),
  })
  .strict();

const bulkVerifyEmailsBodySchema = z
  .object({
    userIds: z.array(z.string().uuid()).min(1).max(500),
  })
  .strict();

const exportUsersExcelQuerySchema = z
  .object({
    university_id: z.string().uuid().optional(),
    role: z.string().min(1).max(80).optional(),
    status: userStatusEnum.optional(),
    search: z.string().max(255).optional(),
    email_verified: z
      .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0'), z.boolean()])
      .optional(),
    apply_filters: z
      .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0'), z.boolean()])
      .optional(),
  })
  .strict()
  .transform((q) => {
    let emailVerified;
    if (q.email_verified === true || q.email_verified === 'true' || q.email_verified === '1') {
      emailVerified = true;
    } else if (q.email_verified === false || q.email_verified === 'false' || q.email_verified === '0') {
      emailVerified = false;
    }
    let applyFilters = true;
    if (q.apply_filters === false || q.apply_filters === 'false' || q.apply_filters === '0') {
      applyFilters = false;
    }
    return {
      university_id: q.university_id,
      role: q.role?.trim().toLowerCase() || undefined,
      status: q.status,
      search: q.search?.trim() || undefined,
      email_verified: emailVerified,
      apply_filters: applyFilters,
    };
  });

module.exports = {
  uuidParamSchema,
  listUsersQuerySchema,
  createUserBodySchema,
  updateUserBodySchema,
  patchUserStatusBodySchema,
  adminResetPasswordBodySchema,
  activatePendingQuerySchema,
  activatePendingBodySchema,
  verifyAllEmailsQuerySchema,
  verifyAllEmailsBodySchema,
  bulkVerifyEmailsBodySchema,
  exportUsersExcelQuerySchema,
};
