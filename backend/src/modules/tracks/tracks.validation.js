const { z } = require('zod');

const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid track id'),
});

const trackStatusEnum = z.enum(['active', 'inactive', 'archived']);

const listTracksQuerySchema = z
  .object({
    status: trackStatusEnum.optional(),
    search: z.string().max(255).optional(),
  })
  .strict()
  .transform((q) => ({
    status: q.status,
    search: q.search?.trim() || undefined,
  }));

const createTrackBodySchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(255),
    code: z.string().min(1, 'Code is required').max(80),
    description: z.string().max(5000).optional().nullable(),
    status: trackStatusEnum.optional(),
  })
  .strict()
  .transform((b) => ({
    name: b.name.trim(),
    code: b.code.trim().toUpperCase(),
    description: b.description === null || b.description === '' ? null : b.description?.trim(),
    status: b.status ?? 'active',
  }));

const updateTrackBodySchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    code: z.string().min(1).max(80).optional(),
    description: z.string().max(5000).optional().nullable(),
    status: trackStatusEnum.optional(),
  })
  .strict()
  .refine(
    (b) =>
      b.name !== undefined || b.code !== undefined || b.description !== undefined || b.status !== undefined,
    { message: 'At least one field is required' }
  )
  .transform((b) => ({
    name: b.name?.trim(),
    code: b.code?.trim().toUpperCase(),
    description: b.description === null || b.description === '' ? null : b.description?.trim(),
    status: b.status,
  }));

module.exports = {
  uuidParamSchema,
  listTracksQuerySchema,
  createTrackBodySchema,
  updateTrackBodySchema,
};
