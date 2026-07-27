const { z } = require('zod');

const universityIdParamSchema = z.object({
  universityId: z.string().uuid('الجامعة المحددة غير صالحة'),
});

/**
 * Public student self-registration only — unknown keys rejected (.strict()).
 */
const registerSchema = z
  .object({
    full_name: z.string().min(1, 'يرجى إدخال الاسم الرباعي.').max(255),
    email: z.string().email('يرجى إدخال بريد إلكتروني صحيح.').max(255),
    password: z.string().min(8, 'كلمة المرور يجب أن تحتوي على 8 أحرف على الأقل.'),
    university_id: z.string().uuid('يرجى اختيار الجامعة.'),
    university_specialty_id: z.string().uuid('يرجى إدخال التخصص.'),
    phone: z.string().max(50, 'رقم الهاتف غير صحيح.').optional(),
  })
  .strict()
  .transform((b) => ({
    full_name: b.full_name.trim(),
    email: b.email.trim().toLowerCase(),
    password: b.password,
    university_id: b.university_id,
    university_specialty_id: b.university_specialty_id,
    phone: b.phone?.trim() || undefined,
  }));

const loginSchema = z
  .object({
    email: z.string().email('يرجى إدخال بريد إلكتروني صحيح.').max(255),
    password: z.string().min(1, 'كلمة المرور مطلوبة'),
  })
  .strict()
  .transform((b) => ({
    email: b.email.trim().toLowerCase(),
    password: b.password,
  }));

const accountStatusSchema = loginSchema;

const verifyEmailOtpSchema = z
  .object({
    email: z.string().email('يرجى إدخال بريد إلكتروني صحيح.').max(255),
    otp: z
      .string()
      .regex(/^\d{6}$/, 'رمز التحقق يجب أن يتكون من 6 أرقام.'),
  })
  .strict()
  .transform((b) => ({
    email: b.email.trim().toLowerCase(),
    otp: b.otp.trim(),
  }));

const resendEmailOtpSchema = z
  .object({
    email: z.string().email('يرجى إدخال بريد إلكتروني صحيح.').max(255),
  })
  .strict()
  .transform((b) => ({
    email: b.email.trim().toLowerCase(),
  }));

const forgotPasswordSchema = z
  .object({
    email: z.string().email('يرجى إدخال بريد إلكتروني صحيح.').max(255),
  })
  .strict()
  .transform((b) => ({
    email: b.email.trim().toLowerCase(),
  }));

const verifyPasswordResetOtpSchema = z
  .object({
    email: z.string().email('يرجى إدخال بريد إلكتروني صحيح.').max(255),
    otp: z.string().regex(/^\d{6}$/, 'رمز التحقق يجب أن يتكون من 6 أرقام.'),
  })
  .strict()
  .transform((b) => ({
    email: b.email.trim().toLowerCase(),
    otp: b.otp.trim(),
  }));

const resendPasswordResetOtpSchema = forgotPasswordSchema;

const resetPasswordSchema = z
  .object({
    email: z.string().email('يرجى إدخال بريد إلكتروني صحيح.').max(255),
    resetToken: z.string().min(1, 'جلسة إعادة التعيين غير صالحة أو منتهية الصلاحية.'),
    newPassword: z.string().min(8, 'كلمة المرور يجب أن تحتوي على 8 أحرف على الأقل.'),
    confirmPassword: z.string().min(8, 'تأكيد كلمة المرور مطلوب'),
  })
  .strict()
  .transform((b) => ({
    email: b.email.trim().toLowerCase(),
    resetToken: b.resetToken.trim(),
    newPassword: b.newPassword,
    confirmPassword: b.confirmPassword,
  }))
  .refine((b) => b.newPassword === b.confirmPassword, {
    message: 'كلمتا المرور غير متطابقتين.',
    path: ['confirmPassword'],
  });

module.exports = {
  registerSchema,
  loginSchema,
  accountStatusSchema,
  universityIdParamSchema,
  verifyEmailOtpSchema,
  resendEmailOtpSchema,
  forgotPasswordSchema,
  verifyPasswordResetOtpSchema,
  resendPasswordResetOtpSchema,
  resetPasswordSchema,
};
