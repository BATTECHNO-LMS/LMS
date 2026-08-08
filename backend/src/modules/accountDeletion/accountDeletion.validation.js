'use strict';

const { z } = require('zod');

const CONFIRMATION_PHRASE = 'DELETE';

const createDeletionRequestSchema = z
  .object({
    reason: z.string().trim().max(1000).optional().nullable(),
    confirmation: z.literal(CONFIRMATION_PHRASE, {
      errorMap: () => ({ message: 'Confirmation phrase DELETE is required' }),
    }),
    currentPassword: z.string().min(1).max(200),
  })
  .strict();

const processDeletionRequestSchema = z
  .object({
    status: z.enum(['processing', 'completed', 'rejected']),
    resolution_note: z.string().trim().max(2000).optional().nullable(),
    confirmation: z.literal(CONFIRMATION_PHRASE, {
      errorMap: () => ({ message: 'Confirmation phrase DELETE is required' }),
    }),
  })
  .strict();

module.exports = {
  CONFIRMATION_PHRASE,
  createDeletionRequestSchema,
  processDeletionRequestSchema,
};
