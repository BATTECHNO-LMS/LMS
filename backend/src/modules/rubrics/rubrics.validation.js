const { z } = require('zod');

const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

const criterionIdParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

const listRubricsQuerySchema = z
  .object({
    status: z.string().max(50).optional(),
    search: z.string().max(255).optional(),
  })
  .strict()
  .transform((q) => ({
    status: q.status?.trim() || undefined,
    search: q.search?.trim() || undefined,
  }));

const createRubricBodySchema = z
  .object({
    title: z.string().min(1).max(255),
    description: z.string().max(10000).optional().nullable(),
    status: z.string().max(50).optional(),
  })
  .strict()
  .transform((b) => ({ ...b, title: b.title.trim() }));

const updateRubricBodySchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().max(10000).optional().nullable(),
    status: z.string().max(50).optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: 'At least one field is required' });

const createCriterionBodySchema = z
  .object({
    criterion_name: z.string().min(1).max(255),
    criterion_description: z.string().max(5000).optional().nullable(),
    weight: z.coerce.number().gt(0).max(100),
  })
  .strict()
  .transform((b) => ({ ...b, criterion_name: b.criterion_name.trim() }));

const updateCriterionBodySchema = z
  .object({
    criterion_name: z.string().min(1).max(255).optional(),
    criterion_description: z.string().max(5000).optional().nullable(),
    weight: z.coerce.number().gt(0).max(100).optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: 'At least one field is required' });

module.exports = {
  uuidParamSchema,
  criterionIdParamSchema,
  listRubricsQuerySchema,
  createRubricBodySchema,
  updateRubricBodySchema,
  createCriterionBodySchema,
  updateCriterionBodySchema,
};
