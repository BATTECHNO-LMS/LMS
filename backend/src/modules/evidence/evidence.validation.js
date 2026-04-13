const { z } = require('zod');

const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

const listEvidenceQuerySchema = z
  .object({
    micro_credential_id: z.string().uuid().optional(),
    cohort_id: z.string().uuid().optional(),
    student_id: z.string().uuid().optional(),
    assessment_id: z.string().uuid().optional(),
    session_id: z.string().uuid().optional(),
    evidence_type: z.string().max(100).optional(),
    search: z.string().max(255).optional(),
  })
  .strict()
  .transform((q) => ({
    micro_credential_id: q.micro_credential_id,
    cohort_id: q.cohort_id,
    student_id: q.student_id,
    assessment_id: q.assessment_id,
    session_id: q.session_id,
    evidence_type: q.evidence_type?.trim() || undefined,
    search: q.search?.trim() || undefined,
  }));

const createEvidenceBodySchema = z
  .object({
    micro_credential_id: z.string().uuid(),
    cohort_id: z.string().uuid(),
    title: z.string().min(1).max(255),
    evidence_type: z.string().min(1).max(100),
    file_url: z.string().min(1).max(2000),
    student_id: z.string().uuid().optional().nullable(),
    assessment_id: z.string().uuid().optional().nullable(),
    session_id: z.string().uuid().optional().nullable(),
    uploaded_by: z.string().uuid().optional().nullable(),
  })
  .strict();

const updateEvidenceBodySchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    evidence_type: z.string().min(1).max(100).optional(),
    file_url: z.string().min(1).max(2000).optional(),
    student_id: z.string().uuid().optional().nullable(),
    assessment_id: z.string().uuid().optional().nullable(),
    session_id: z.string().uuid().optional().nullable(),
    uploaded_by: z.string().uuid().optional().nullable(),
  })
  .strict();

module.exports = {
  uuidParamSchema,
  listEvidenceQuerySchema,
  createEvidenceBodySchema,
  updateEvidenceBodySchema,
};
