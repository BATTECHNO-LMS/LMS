const { z } = require('zod');

const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

const documentTypeEnum = z.enum([
  'credential_description',
  'alignment_matrix',
  'attendance_report',
  'grades_report',
  'evidence_samples',
  'delivery_report',
  'qa_report',
  'academic_recommendation',
  'other',
]);

const createDocumentBodySchema = z
  .object({
    document_type: documentTypeEnum,
    title: z.string().min(1).max(255),
    file_url: z.string().min(1).max(2000),
  })
  .strict();

const updateDocumentBodySchema = z
  .object({
    document_type: documentTypeEnum.optional(),
    title: z.string().min(1).max(255).optional(),
    file_url: z.string().min(1).max(2000).optional(),
  })
  .strict();

module.exports = {
  uuidParamSchema,
  createDocumentBodySchema,
  updateDocumentBodySchema,
  documentTypeEnum,
};
