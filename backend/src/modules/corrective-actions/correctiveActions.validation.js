const { z } = require('zod');

const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

const correctiveStatusEnum = z.enum(['open', 'in_progress', 'resolved', 'closed', 'overdue']);

const listCorrectiveQuerySchema = z
  .object({
    qa_review_id: z.string().uuid().optional(),
    assigned_to: z.string().uuid().optional(),
    status: correctiveStatusEnum.optional(),
    overdue: z.enum(['true', 'false']).optional(),
    search: z.string().max(255).optional(),
  })
  .strict()
  .transform((q) => ({
    qa_review_id: q.qa_review_id,
    assigned_to: q.assigned_to,
    status: q.status,
    overdue: q.overdue === 'true' ? true : q.overdue === 'false' ? false : undefined,
    search: q.search?.trim() || undefined,
  }));

const createCorrectiveBodySchema = z
  .object({
    qa_review_id: z.string().uuid(),
    action_text: z.string().min(1).max(20000),
    due_date: z.string().min(1).max(40),
    assigned_to: z.string().uuid().optional().nullable(),
    status: correctiveStatusEnum.optional(),
  })
  .strict();

const updateCorrectiveBodySchema = z
  .object({
    action_text: z.string().min(1).max(20000).optional(),
    due_date: z.string().min(1).max(40).optional(),
    assigned_to: z.string().uuid().optional().nullable(),
    status: correctiveStatusEnum.optional(),
  })
  .strict();

const patchCorrectiveStatusBodySchema = z
  .object({
    status: correctiveStatusEnum,
  })
  .strict();

module.exports = {
  uuidParamSchema,
  listCorrectiveQuerySchema,
  createCorrectiveBodySchema,
  updateCorrectiveBodySchema,
  patchCorrectiveStatusBodySchema,
};
