import { z } from 'zod';

/** Mirrors backend createSubmissionBodySchema / updateSubmissionBodySchema. */
export const SUBMISSION_TYPE_VALUES = ['file', 'repo_url', 'text_response', 'mixed'];

export const createAcademicSubmissionSchema = z
  .object({
    submission_type: z.enum(SUBMISSION_TYPE_VALUES),
    file_url: z.string().max(2000).optional().nullable(),
    repo_url: z.string().max(2000).optional().nullable(),
    text_response: z.string().max(50000).optional().nullable(),
  })
  .strict()
  .superRefine((b, ctx) => {
    const hasContent =
      Boolean(b.text_response?.trim()) || Boolean(b.file_url?.trim()) || Boolean(b.repo_url?.trim());
    if (!hasContent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide text, a file URL, or a repository URL',
        path: ['text_response'],
      });
    }
  });

export const updateAcademicSubmissionSchema = z
  .object({
    submission_type: z.enum(SUBMISSION_TYPE_VALUES).optional(),
    file_url: z.string().max(2000).optional().nullable(),
    repo_url: z.string().max(2000).optional().nullable(),
    text_response: z.string().max(50000).optional().nullable(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: 'At least one field is required' });

/** Mirrors backend createGradeBodySchema / updateGradeBodySchema. */
export const createAcademicGradeSchema = z
  .object({
    student_id: z.string().uuid(),
    score: z.coerce.number().min(0).max(100),
    feedback: z.string().max(20000).optional().nullable(),
    is_final: z.coerce.boolean().optional(),
  })
  .strict();

export const updateAcademicGradeSchema = z
  .object({
    score: z.coerce.number().min(0).max(100).optional(),
    feedback: z.string().max(20000).optional().nullable(),
    is_final: z.coerce.boolean().optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: 'At least one field is required' });
