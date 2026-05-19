const { z } = require('zod');

const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

const opportunityIdParamSchema = z.object({
  opportunityId: z.string().uuid(),
});

const applicationIdParamSchema = z.object({
  applicationId: z.string().uuid(),
});

const trainingModeSchema = z.enum(['onsite', 'remote', 'hybrid']);
const opportunityStatusSchema = z.enum(['draft', 'published', 'archived']);
const applicationStatusSchema = z.enum(['pending', 'approved', 'rejected', 'cancelled']);

const optionalDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .nullable();

const listAdminQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: opportunityStatusSchema.optional(),
  training_mode: trainingModeSchema.optional(),
});

const opportunityBodySchema = z.object({
  title: z.string().min(1).max(255),
  organization_name: z.string().min(1).max(255),
  location: z.string().min(1).max(255),
  training_mode: trainingModeSchema,
  short_description: z.string().max(2000).optional().nullable(),
  description: z.string().max(50000).optional().nullable(),
  requirements: z.string().max(50000).optional().nullable(),
  benefits: z.string().max(50000).optional().nullable(),
  seats_limit: z.coerce.number().int().min(1).max(10000).optional().nullable(),
  start_date: optionalDateSchema,
  end_date: optionalDateSchema,
  application_deadline: optionalDateSchema,
});

const updateOpportunityBodySchema = opportunityBodySchema.partial();

const applyBodySchema = z.object({
  student_message: z.string().max(5000).optional().nullable(),
});

const reviewApplicationBodySchema = z.object({
  status: z.enum(['approved', 'rejected']),
  admin_note: z.string().max(5000).optional().nullable(),
});

const listStudentQuerySchema = z.object({
  search: z.string().optional(),
  training_mode: trainingModeSchema.optional(),
});

const taskIdParamSchema = z.object({
  taskId: z.string().uuid(),
});

const taskBodySchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(10000).optional().nullable(),
  sort_order: z.coerce.number().int().min(0).max(10000).optional(),
  due_date: optionalDateSchema,
});

const updateTaskBodySchema = taskBodySchema.partial();

module.exports = {
  uuidParamSchema,
  opportunityIdParamSchema,
  applicationIdParamSchema,
  taskIdParamSchema,
  taskBodySchema,
  updateTaskBodySchema,
  listAdminQuerySchema,
  opportunityBodySchema,
  updateOpportunityBodySchema,
  applyBodySchema,
  reviewApplicationBodySchema,
  listStudentQuerySchema,
};
