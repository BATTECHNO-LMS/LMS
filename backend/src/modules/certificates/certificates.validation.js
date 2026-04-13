const { z } = require('zod');

const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

const certificateStatusEnum = z.enum(['issued', 'revoked', 'superseded']);

const verifyParamSchema = z.object({
  verificationCode: z.string().min(8).max(64),
});

const listCertificatesQuerySchema = z
  .object({
    university_id: z.string().uuid().optional(),
    student_id: z.string().uuid().optional(),
    cohort_id: z.string().uuid().optional(),
    micro_credential_id: z.string().uuid().optional(),
    status: certificateStatusEnum.optional(),
    search: z.string().max(255).optional(),
  })
  .strict()
  .transform((q) => ({
    university_id: q.university_id,
    student_id: q.student_id,
    cohort_id: q.cohort_id,
    micro_credential_id: q.micro_credential_id,
    status: q.status,
    search: q.search?.trim() || undefined,
  }));

const createCertificateBodySchema = z
  .object({
    student_id: z.string().uuid(),
    cohort_id: z.string().uuid(),
    micro_credential_id: z.string().uuid(),
    qr_code_url: z.string().max(2000).optional().nullable(),
    status: certificateStatusEnum.optional(),
  })
  .strict();

const patchCertificateStatusBodySchema = z
  .object({
    status: certificateStatusEnum,
  })
  .strict();

module.exports = {
  uuidParamSchema,
  verifyParamSchema,
  listCertificatesQuerySchema,
  createCertificateBodySchema,
  patchCertificateStatusBodySchema,
  certificateStatusEnum,
};
