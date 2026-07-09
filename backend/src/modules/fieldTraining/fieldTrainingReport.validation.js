const { z } = require('zod');

const uuidSchema = z.string().uuid();

const reportFiltersSchema = z.object({
  university_id: uuidSchema.optional(),
  university_specialty_id: uuidSchema.optional(),
  opportunity_id: uuidSchema.optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  training_status: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const dateRangeQuerySchema = reportFiltersSchema;

const exportFormatSchema = reportFiltersSchema.extend({
  format: z.enum(['pdf', 'xlsx', 'excel']).optional().default('pdf'),
});

const applicationIdParamSchema = z.object({
  applicationId: uuidSchema,
});

const universityIdParamSchema = z.object({
  universityId: uuidSchema.optional(),
});

module.exports = {
  reportFiltersSchema,
  dateRangeQuerySchema,
  exportFormatSchema,
  applicationIdParamSchema,
  universityIdParamSchema,
};
