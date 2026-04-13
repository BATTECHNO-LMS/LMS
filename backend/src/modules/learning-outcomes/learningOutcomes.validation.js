const { z } = require('zod');

const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid learning outcome id'),
});

const microCredentialIdParamSchema = z.object({
  microCredentialId: z.string().uuid('Invalid micro-credential id'),
});

const createLearningOutcomeBodySchema = z
  .object({
    outcome_code: z.string().min(1, 'Outcome code is required').max(80),
    outcome_text: z.string().min(1, 'Outcome text is required').max(10000),
    outcome_type: z.string().max(100).optional().nullable(),
  })
  .strict()
  .transform((b) => ({
    outcome_code: b.outcome_code.trim(),
    outcome_text: b.outcome_text.trim(),
    outcome_type: b.outcome_type === null || b.outcome_type === '' ? null : b.outcome_type?.trim(),
  }));

const updateLearningOutcomeBodySchema = z
  .object({
    outcome_code: z.string().min(1).max(80).optional(),
    outcome_text: z.string().min(1).max(10000).optional(),
    outcome_type: z.string().max(100).optional().nullable(),
  })
  .strict()
  .refine(
    (b) => b.outcome_code !== undefined || b.outcome_text !== undefined || b.outcome_type !== undefined,
    { message: 'At least one field is required' }
  )
  .transform((b) => ({
    outcome_code: b.outcome_code?.trim(),
    outcome_text: b.outcome_text?.trim(),
    outcome_type:
      b.outcome_type === null || b.outcome_type === '' ? null : b.outcome_type === undefined ? undefined : b.outcome_type.trim(),
  }));

module.exports = {
  uuidParamSchema,
  microCredentialIdParamSchema,
  createLearningOutcomeBodySchema,
  updateLearningOutcomeBodySchema,
};
