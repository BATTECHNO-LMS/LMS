const { z } = require('zod');

const updateSettingsBodySchema = z
  .object({
    platform_name: z.string().min(1).max(255).optional(),
    timezone: z.string().min(1).max(120).optional(),
    default_locale: z.enum(['ar', 'en']).optional(),
    support_email: z.string().email().optional().nullable(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'At least one setting is required' });

module.exports = { updateSettingsBodySchema };
