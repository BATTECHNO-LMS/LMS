const { z } = require('zod');

const platformEnum = z.enum(['android', 'ios']);

const registerPushSchema = z
  .object({
    registration_token: z
      .string({ required_error: 'Registration token is required' })
      .trim()
      .min(1, 'Registration token is required')
      .max(512, 'Registration token is too long'),
    platform: platformEnum,
    app_version: z.string().trim().max(40).optional(),
    locale: z.string().trim().max(16).optional(),
    permission_status: z.string().trim().max(32).optional(),
    app_id: z.string().trim().max(120).optional(),
    device_installation_id: z.string().trim().max(120).optional(),
  })
  .strict();

const unregisterPushSchema = z
  .object({
    registration_token: z
      .string({ required_error: 'Registration token is required' })
      .trim()
      .min(1, 'Registration token is required')
      .max(512, 'Registration token is too long'),
  })
  .strict();

module.exports = {
  platformEnum,
  registerPushSchema,
  unregisterPushSchema,
};
