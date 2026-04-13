const { z } = require('zod');

const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

const listGradesQuerySchema = z
  .object({
    assessment_id: z.string().uuid().optional(),
    student_id: z.string().uuid().optional(),
    cohort_id: z.string().uuid().optional(),
    is_final: z.string().optional(),
  })
  .strict()
  .transform((q) => ({
    assessment_id: q.assessment_id,
    student_id: q.student_id,
    cohort_id: q.cohort_id,
    is_final:
      q.is_final === undefined ? undefined : q.is_final === 'true' || q.is_final === '1',
  }));

const createGradeBodySchema = z
  .object({
    student_id: z.string().uuid(),
    score: z.coerce.number().min(0).max(100),
    feedback: z.string().max(20000).optional().nullable(),
    is_final: z.coerce.boolean().optional(),
  })
  .strict();

const updateGradeBodySchema = z
  .object({
    score: z.coerce.number().min(0).max(100).optional(),
    feedback: z.string().max(20000).optional().nullable(),
    is_final: z.coerce.boolean().optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: 'At least one field is required' });

const studentIdParamSchema = z.object({
  studentId: z.string().uuid('Invalid student id'),
});

module.exports = {
  uuidParamSchema,
  listGradesQuerySchema,
  createGradeBodySchema,
  updateGradeBodySchema,
  studentIdParamSchema,
};
