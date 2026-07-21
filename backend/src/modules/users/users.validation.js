const { z } = require('zod');
const { DEFAULT_PAGE_SIZE, ADMIN_MAX_PAGE_SIZE } = require('../../utils/pagination');

const uuidParamSchema = z.object({
  id: z.string().uuid('معرّف المستخدم غير صالح'),
});

const userStatusEnum = z.enum(['active', 'inactive', 'suspended'], {
  errorMap: () => ({ message: 'حالة الحساب غير صالحة' }),
});

const listUsersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(ADMIN_MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    status: userStatusEnum.optional(),
    university_id: z.string().uuid().optional(),
    role: z.string().min(1).max(80).optional(),
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
      role: q.role?.trim().toLowerCase() || undefined,
      search: q.search?.trim() || undefined,
      email_verified: emailVerified,
    };
  });

const optionalUuid = z
  .union([z.string().uuid(), z.literal(''), z.null()])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === null || v === '') return null;
    return v;
  });

const createUserBodySchema = z
  .object({
    full_name: z.string().min(1, 'الاسم الكامل مطلوب').max(255),
    email: z.string().email('صيغة البريد غير صالحة').max(255),
    password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل').max(128),
    phone: z.string().max(50).optional().nullable(),
    status: userStatusEnum.optional(),
    /** Independent of account status — does not auto-activate. */
    email_verified: z.coerce.boolean().optional(),
    primary_university_id: optionalUuid,
    university_specialty_id: optionalUuid,
    specialty_id: optionalUuid,
    role_codes: z.array(z.string().min(1).max(80)).min(1, 'يجب اختيار دور واحد على الأقل'),
    university_relationship_type: z.string().min(1).max(100).optional(),
  })
  .strict()
  .transform((b) => ({
    full_name: b.full_name.trim(),
    email: b.email.trim().toLowerCase(),
    password: b.password,
    phone: b.phone == null || b.phone === '' ? null : String(b.phone).trim() || null,
    status: b.status,
    email_verified: b.email_verified,
    primary_university_id: b.primary_university_id,
    university_specialty_id: b.university_specialty_id,
    specialty_id: b.specialty_id,
    role_codes: [...new Set(b.role_codes.map((c) => c.trim().toLowerCase()))],
    university_relationship_type: b.university_relationship_type?.trim() || undefined,
  }));

const updateUserBodySchema = z
  .object({
    full_name: z.string().min(1, 'الاسم الكامل مطلوب').max(255).optional(),
    email: z.string().email('صيغة البريد غير صالحة').max(255).optional(),
    phone: z.string().max(50).optional().nullable(),
    status: userStatusEnum.optional(),
    email_verified: z.coerce.boolean().optional(),
    primary_university_id: optionalUuid,
    university_specialty_id: optionalUuid,
    specialty_id: optionalUuid,
    role_codes: z.array(z.string().min(1).max(80)).min(1).optional(),
    university_relationship_type: z.string().min(1).max(100).optional(),
  })
  .strict()
  .refine(
    (b) =>
      b.full_name !== undefined ||
      b.email !== undefined ||
      b.phone !== undefined ||
      b.status !== undefined ||
      b.email_verified !== undefined ||
      b.primary_university_id !== undefined ||
      b.university_specialty_id !== undefined ||
      b.specialty_id !== undefined ||
      b.role_codes !== undefined ||
      b.university_relationship_type !== undefined,
    { message: 'يجب إدخال حقل واحد على الأقل للتحديث' }
  )
  .transform((b) => ({
    full_name: b.full_name?.trim(),
    email: b.email?.trim().toLowerCase(),
    phone: b.phone === null ? null : b.phone === undefined ? undefined : String(b.phone).trim() || null,
    status: b.status,
    email_verified: b.email_verified,
    primary_university_id: b.primary_university_id,
    university_specialty_id: b.university_specialty_id,
    specialty_id: b.specialty_id,
    role_codes: b.role_codes ? [...new Set(b.role_codes.map((c) => c.trim().toLowerCase()))] : undefined,
    university_relationship_type: b.university_relationship_type?.trim() || undefined,
  }));

const adminResetPasswordBodySchema = z
  .object({
    new_password: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل').max(128),
    confirm_password: z.string().min(8).max(128),
  })
  .strict()
  .refine((b) => b.new_password === b.confirm_password, {
    message: 'كلمتا المرور غير متطابقتين',
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
