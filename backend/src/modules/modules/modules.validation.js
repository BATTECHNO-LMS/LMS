const { z } = require('zod');

const listModulesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(20),
    micro_credential_id: z.string().uuid().optional(),
    search: z.string().optional(),
  })
  .transform((q) => ({
    page: q.page,
    page_size: q.page_size,
    micro_credential_id: q.micro_credential_id,
    search: q.search?.trim() || undefined,
  }));

module.exports = { listModulesQuerySchema };
