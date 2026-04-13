const { z } = require('zod');

const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

const sessionTypeEnum = z.enum(['lecture', 'lab', 'workshop', 'review', 'assessment', 'other']);
const documentationStatusEnum = z.enum(['pending', 'documented', 'incomplete']);

const createSessionBodySchema = z
  .object({
    title: z.string().min(1, 'Title is required').max(255),
    session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'session_date must be YYYY-MM-DD'),
    start_time: z.string().min(1, 'start_time is required'),
    end_time: z.string().min(1, 'end_time is required'),
    session_type: sessionTypeEnum.optional(),
    module_id: z.string().uuid().optional().nullable(),
    notes: z.string().max(5000).optional().nullable(),
  })
  .strict()
  .transform((b) => ({
    ...b,
    title: b.title.trim(),
    notes: b.notes === null ? null : b.notes?.trim() || null,
  }));

const updateSessionBodySchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    start_time: z.string().min(1).optional(),
    end_time: z.string().min(1).optional(),
    session_type: sessionTypeEnum.optional(),
    module_id: z.string().uuid().optional().nullable(),
    notes: z.string().max(5000).optional().nullable(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: 'At least one field is required' });

const patchDocumentationBodySchema = z
  .object({
    documentation_status: documentationStatusEnum,
  })
  .strict();

module.exports = {
  uuidParamSchema,
  createSessionBodySchema,
  updateSessionBodySchema,
  patchDocumentationBodySchema,
  sessionTypeEnum,
  documentationStatusEnum,
};
