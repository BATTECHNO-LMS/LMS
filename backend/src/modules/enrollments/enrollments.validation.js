const { z } = require('zod');

const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

const cohortIdParamSchema = z.object({
  id: z.string().uuid('Invalid cohort id'),
});

const createEnrollmentBodySchema = z
  .object({
    student_id: z.string().uuid('student_id must be a UUID'),
  })
  .strict();

const enrollmentStatusEnum = z.enum(['pending', 'enrolled', 'withdrawn', 'cancelled', 'completed']);
const finalStatusEnum = z.enum(['in_progress', 'passed', 'failed', 'withdrawn', 'incomplete']);
const recognitionEligibilityEnum = z.enum(['unknown', 'eligible', 'not_eligible', 'under_review']);

const patchEnrollmentStatusBodySchema = z
  .object({
    enrollment_status: enrollmentStatusEnum.optional(),
    final_status: finalStatusEnum.optional(),
    recognition_eligibility_status: recognitionEligibilityEnum.optional(),
  })
  .strict()
  .refine(
    (b) =>
      b.enrollment_status !== undefined ||
      b.final_status !== undefined ||
      b.recognition_eligibility_status !== undefined,
    { message: 'At least one field is required' }
  );

module.exports = {
  uuidParamSchema,
  cohortIdParamSchema,
  createEnrollmentBodySchema,
  patchEnrollmentStatusBodySchema,
};
