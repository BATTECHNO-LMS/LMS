const { z } = require('zod');

/**
 * Public student self-registration only — unknown keys rejected (.strict()).
 */
const registerSchema = z
  .object({
    full_name: z.string().min(1, 'Full name is required').max(255),
    email: z.string().email('Invalid email').max(255),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    university_id: z.string().uuid('Invalid university'),
    phone: z.string().max(50).optional(),
  })
  .strict()
  .transform((b) => ({
    full_name: b.full_name.trim(),
    email: b.email.trim().toLowerCase(),
    password: b.password,
    university_id: b.university_id,
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

module.exports = { registerSchema, loginSchema };
