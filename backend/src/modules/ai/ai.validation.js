const { z } = require('zod');

const generateBodySchema = z.object({
  prompt: z.string().min(1).max(20000),
  context: z.string().max(20000).optional().nullable(),
  purpose: z.string().max(200).optional().nullable(),
});

module.exports = { generateBodySchema };
