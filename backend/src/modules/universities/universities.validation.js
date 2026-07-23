const { z } = require('zod');
const { normalizeEmailDomain } = require('../../utils/normalizeEmailDomain');

const uuidParamSchema = z.object({
  id: z.string().uuid('معرّف الجامعة غير صالح'),
});

const universityStatusEnum = z.enum(['active', 'inactive', 'archived'], {
  errorMap: () => ({ message: 'حالة الجامعة غير صالحة' }),
});
const partnershipStateEnum = z.enum(['active', 'inactive', 'pending', 'ended'], {
  errorMap: () => ({ message: 'حالة الشراكة غير صالحة' }),
});
const specialtyStatusEnum = z.enum(['active', 'inactive'], {
  errorMap: () => ({ message: 'حالة التخصص غير صالحة' }),
});

const emptyListQuerySchema = z.object({}).strict();

const getUniversityQuerySchema = z
  .object({
    include_counts: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => v === 'true'),
  })
  .strict();

const optionalTrimmed = (max) =>
  z
    .union([z.string().max(max), z.literal(''), z.null()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (v === null || v === '') return null;
      const t = String(v).trim();
      return t || null;
    });

const emailDomainItemSchema = z
  .object({
    id: z.string().uuid().optional().nullable(),
    domain: z.string().min(1, 'اسم النطاق مطلوب').max(255),
    is_active: z.coerce.boolean().optional().default(true),
    is_primary: z.coerce.boolean().optional().default(false),
  })
  .strict()
  .superRefine((item, ctx) => {
    const normalized = normalizeEmailDomain(item.domain);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['domain'],
        message: 'صيغة نطاق البريد غير صالحة',
      });
    }
  })
  .transform((item) => ({
    ...item,
    domain: normalizeEmailDomain(item.domain),
  }));

const specialtyItemSchema = z
  .object({
    id: z.string().uuid().optional().nullable(),
    name_ar: z.string().min(1, 'الاسم العربي للتخصص مطلوب').max(255),
    name_en: optionalTrimmed(255),
    code: z.string().min(1, 'كود التخصص مطلوب').max(80),
    college_name_ar: optionalTrimmed(255),
    college_name_en: optionalTrimmed(255),
    specialty_id: z.union([z.string().uuid(), z.literal(''), z.null()]).optional(),
    status: specialtyStatusEnum.optional().default('active'),
  })
  .strict()
  .transform((item) => ({
    ...item,
    code: String(item.code).trim().toUpperCase(),
    name_ar: String(item.name_ar).trim(),
    name_en: item.name_en === undefined ? undefined : item.name_en,
    college_name_ar: item.college_name_ar === undefined ? undefined : item.college_name_ar,
    college_name_en: item.college_name_en === undefined ? undefined : item.college_name_en,
    specialty_id:
      item.specialty_id === undefined
        ? undefined
        : item.specialty_id === null || item.specialty_id === ''
          ? null
          : item.specialty_id,
  }));

function refineDomainsUnique(domains, ctx) {
  if (!domains?.length) return;
  const seen = new Set();
  let primaryCount = 0;
  domains.forEach((d, index) => {
    if (seen.has(d.domain)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['email_domains', index, 'domain'],
        message: 'لا يمكن تكرار نطاق البريد داخل نفس الجامعة',
      });
    }
    seen.add(d.domain);
    if (d.is_primary && d.is_active !== false) primaryCount += 1;
  });
  if (primaryCount > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['email_domains'],
      message: 'يُسمح بنطاق أساسي واحد فقط للجامعة',
    });
  }
}

function refineSpecialtyCodesUnique(specialties, ctx) {
  if (!specialties?.length) return;
  const seen = new Set();
  specialties.forEach((s, index) => {
    const key = String(s.code || '').trim().toUpperCase();
    if (!key) return;
    if (seen.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['specialties', index, 'code'],
        message: 'لا يمكن تكرار كود التخصص داخل نفس الجامعة',
      });
    }
    seen.add(key);
  });
}

const universityCoreFields = {
  name: z.string().min(1, 'اسم الجامعة بالعربية مطلوب').max(255),
  name_en: optionalTrimmed(255),
  short_name: optionalTrimmed(80),
  code: optionalTrimmed(50),
  type: optionalTrimmed(120),
  website: optionalTrimmed(500),
  country: optionalTrimmed(120),
  city: optionalTrimmed(120),
  address: optionalTrimmed(500),
  contact_person: optionalTrimmed(255),
  contact_email: z
    .union([z.string().email('صيغة البريد الرسمي غير صالحة').max(255), z.literal(''), z.null()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (v === null || v === '') return null;
      return String(v).trim().toLowerCase();
    }),
  contact_phone: optionalTrimmed(50),
  logo_url: optionalTrimmed(1000),
  status: universityStatusEnum.optional(),
  partnership_state: partnershipStateEnum.optional(),
  notes: z
    .union([z.string().max(20000), z.literal(''), z.null()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (v === null || v === '') return null;
      return String(v);
    }),
  email_domains: z.array(emailDomainItemSchema).optional(),
  specialties: z.array(specialtyItemSchema).optional(),
};

const createUniversityBodySchema = z
  .object({
    ...universityCoreFields,
    name: z.string().min(1, 'اسم الجامعة بالعربية مطلوب').max(255),
  })
  .strict()
  .superRefine((body, ctx) => {
    refineDomainsUnique(body.email_domains, ctx);
    refineSpecialtyCodesUnique(body.specialties, ctx);
  });

const updateUniversityBodySchema = z
  .object({
    name: z.string().min(1, 'اسم الجامعة بالعربية مطلوب').max(255).optional(),
    name_en: optionalTrimmed(255),
    short_name: optionalTrimmed(80),
    code: optionalTrimmed(50),
    type: optionalTrimmed(120),
    website: optionalTrimmed(500),
    country: optionalTrimmed(120),
    city: optionalTrimmed(120),
    address: optionalTrimmed(500),
    contact_person: optionalTrimmed(255),
    contact_email: z
      .union([z.string().email('صيغة البريد الرسمي غير صالحة').max(255), z.literal(''), z.null()])
      .optional()
      .transform((v) => {
        if (v === undefined) return undefined;
        if (v === null || v === '') return null;
        return String(v).trim().toLowerCase();
      }),
    contact_phone: optionalTrimmed(50),
    logo_url: optionalTrimmed(1000),
    status: universityStatusEnum.optional(),
    partnership_state: partnershipStateEnum.optional(),
    notes: z
      .union([z.string().max(20000), z.literal(''), z.null()])
      .optional()
      .transform((v) => {
        if (v === undefined) return undefined;
        if (v === null || v === '') return null;
        return String(v);
      }),
    email_domains: z.array(emailDomainItemSchema).optional(),
    specialties: z.array(specialtyItemSchema).optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    const keys = Object.keys(body);
    if (keys.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'يجب إدخال حقل واحد على الأقل للتحديث' });
    }
    refineDomainsUnique(body.email_domains, ctx);
    refineSpecialtyCodesUnique(body.specialties, ctx);
  });

module.exports = {
  uuidParamSchema,
  emptyListQuerySchema,
  getUniversityQuerySchema,
  createUniversityBodySchema,
  updateUniversityBodySchema,
  normalizeEmailDomain,
};
