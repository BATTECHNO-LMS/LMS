const { z } = require('zod');

const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid university id'),
});

const universityStatusEnum = z.enum(['active', 'inactive', 'archived']);
const partnershipStateEnum = z.enum(['active', 'inactive', 'pending', 'ended']);

const emptyListQuerySchema = z.object({}).strict();

const getUniversityQuerySchema = z
  .object({
    include_counts: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => v === 'true'),
  })
  .strict();

const createUniversityBodySchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(255),
    type: z.string().max(120).optional().nullable(),
    contact_person: z.string().max(255).optional().nullable(),
    contact_email: z.union([z.string().email().max(255), z.literal('')]).optional().nullable(),
    contact_phone: z.string().max(50).optional().nullable(),
    status: universityStatusEnum.optional(),
    partnership_state: partnershipStateEnum.optional(),
    notes: z.string().optional().nullable(),
  })
  .strict();

const updateUniversityBodySchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    type: z.string().max(120).optional().nullable(),
    contact_person: z.string().max(255).optional().nullable(),
    contact_email: z.union([z.string().email().max(255), z.literal('')]).optional().nullable(),
    contact_phone: z.string().max(50).optional().nullable(),
    status: universityStatusEnum.optional(),
    partnership_state: partnershipStateEnum.optional(),
    notes: z.string().optional().nullable(),
  })
  .strict()
  .refine(
    (b) =>
      b.name !== undefined ||
      b.type !== undefined ||
      b.contact_person !== undefined ||
      b.contact_email !== undefined ||
      b.contact_phone !== undefined ||
      b.status !== undefined ||
      b.partnership_state !== undefined ||
      b.notes !== undefined,
    { message: 'At least one field is required' }
  );

module.exports = {
  uuidParamSchema,
  emptyListQuerySchema,
  getUniversityQuerySchema,
  createUniversityBodySchema,
  updateUniversityBodySchema,
};
