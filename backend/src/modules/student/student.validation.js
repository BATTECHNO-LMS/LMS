const { z } = require('zod');

const enrollmentRequestBodySchema = z
  .object({
    cohort_id: z.string().uuid('cohort_id must be a UUID'),
  })
  .strict();

module.exports = { enrollmentRequestBodySchema };
