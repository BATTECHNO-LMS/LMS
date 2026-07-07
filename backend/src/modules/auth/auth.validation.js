const { z } = require('zod');

const universityIdParamSchema = z.object({
  universityId: z.string().uuid('Invalid university'),
});

/**
 * Public student self-registration only — unknown keys rejected (.strict()).
 */
const registerSchema = z
  .object({
    full_name: z.string().min(1, 'Full name is required').max(255),
    email: z.string().email('Invalid email').max(255),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    university_id: z.string().uuid('Invalid university'),
    specialty_id: z.string().uuid('Invalid specialty'),
    phone: z.string().max(50).optional(),
  })
  .strict()
  .transform((b) => ({
    full_name: b.full_name.trim(),
    email: b.email.trim().toLowerCase(),
    password: b.password,
    university_id: b.university_id,
    specialty_id: b.specialty_id,
    phone: b.phone?.trim() || undefined,
  }));

const loginSchema = z
  .object({
    email: z.string().email('Invalid email').max(255),
    password: z.string().min(1, 'Password is required'),
  })
  .strict()
  .transform((b) => ({
    email: b.email.trim().toLowerCase(),
    password: b.password,
  }));

const verifyEmailOtpSchema = z
  .object({
    email: z.string().email('Invalid email').max(255),
    otp: z
      .string()
      .regex(/^\d{6}$/, 'OTP must be 6 digits'),
  })
  .strict()
  .transform((b) => ({
    email: b.email.trim().toLowerCase(),
    otp: b.otp.trim(),
  }));

const resendEmailOtpSchema = z
  .object({
    email: z.string().email('Invalid email').max(255),
  })
  .strict()
  .transform((b) => ({
    email: b.email.trim().toLowerCase(),
  }));

const forgotPasswordSchema = z
  .object({
    email: z.string().email('Invalid email').max(255),
  })
  .strict()
  .transform((b) => ({
    email: b.email.trim().toLowerCase(),
  }));

const verifyPasswordResetOtpSchema = z
  .object({
    email: z.string().email('Invalid email').max(255),
    otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
  })
  .strict()
  .transform((b) => ({
    email: b.email.trim().toLowerCase(),
    otp: b.otp.trim(),
  }));

const resendPasswordResetOtpSchema = forgotPasswordSchema;

const resetPasswordSchema = z
  .object({
    email: z.string().email('Invalid email').max(255),
    resetToken: z.string().min(1, 'Reset token is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Password confirmation is required'),
  })
  .strict()
  .transform((b) => ({
    email: b.email.trim().toLowerCase(),
    resetToken: b.resetToken.trim(),
    newPassword: b.newPassword,
    confirmPassword: b.confirmPassword,
  }))
  .refine((b) => b.newPassword === b.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

module.exports = {
  registerSchema,
  loginSchema,
  universityIdParamSchema,
  verifyEmailOtpSchema,
  resendEmailOtpSchema,
  forgotPasswordSchema,
  verifyPasswordResetOtpSchema,
  resendPasswordResetOtpSchema,
  resetPasswordSchema,
};
