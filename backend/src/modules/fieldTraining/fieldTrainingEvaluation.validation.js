'use strict';

const { z } = require('zod');

const uuid = z.string().uuid();
const score15 = z.coerce.number().int().min(1).max(5);
const optionalUuid = z.preprocess((v) => (v === '' || v == null ? undefined : v), uuid.optional());
const boolForm = z.preprocess((v) => {
  if (v === true || v === 'true' || v === '1' || v === 1) return true;
  if (v === false || v === 'false' || v === '0' || v === 0) return false;
  return v;
}, z.boolean().optional());

const universityQuerySchema = z.object({
  university_id: optionalUuid,
  include_archived: z.coerce.boolean().optional(),
});

const templateIdParamSchema = z.object({
  templateId: uuid,
});

const evaluationIdParamSchema = z.object({
  evaluationId: uuid,
});

const opportunityIdParamSchema = z.object({
  id: uuid,
});

const applicationIdParamSchema = z.object({
  applicationId: uuid,
});

const uploadTemplateBodySchema = z.object({
  university_id: optionalUuid,
  opportunity_id: optionalUuid,
  name: z.string().max(255).optional(),
  description: z.string().max(4000).optional(),
  is_default: boolForm,
  replace_of: optionalUuid,
  activate: boolForm,
});

const assignTemplateBodySchema = z.object({
  template_id: uuid.nullable().optional(),
});

const policyBodySchema = z.object({
  university_id: uuid.optional(),
  minimum_attendance_percentage: z.coerce.number().min(0).max(100).optional(),
  required_training_hours: z.coerce.number().int().min(0).nullable().optional(),
  required_tasks_required: z.coerce.boolean().optional(),
  post_assessment_required: z.coerce.boolean().optional(),
  professional_evaluation_required: z.coerce.boolean().optional(),
  minimum_passing_score: z.coerce.number().min(0).max(100).optional(),
  attendance_weight: z.coerce.number().min(0).max(100).optional(),
  tasks_weight: z.coerce.number().min(0).max(100).optional(),
  post_assessment_weight: z.coerce.number().min(0).max(100).optional(),
  professional_evaluation_weight: z.coerce.number().min(0).max(100).optional(),
  attendance_bands: z
    .array(
      z.object({
        min: z.number(),
        max: z.number(),
        score: z.number().int().min(1).max(5),
      })
    )
    .optional(),
});

const ratingBodySchema = z.object({
  thinking_and_initiative: score15,
  problem_solving: score15,
  teamwork: score15,
  professional_conduct: score15,
  supervisor_cooperation: score15,
  rules_compliance: score15,
  notes: z.string().max(4000).optional(),
});

const reportListQuerySchema = z.object({
  university_id: uuid.optional(),
  opportunity_id: uuid.optional(),
  student_name: z.string().max(200).optional(),
  university_number: z.string().max(80).optional(),
  final_status: z.enum(['PASSED', 'FAILED', 'NOT_ELIGIBLE']).optional(),
  generated: z.enum(['yes', 'no', 'all']).optional(),
  semester: z.string().max(80).optional(),
  academic_year: z.string().max(20).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const generateBodySchema = z.object({
  application_ids: z.array(uuid).min(1).max(500),
  regenerate: z.coerce.boolean().optional(),
  regeneration_reason: z.string().max(500).optional(),
});

const zipBodySchema = z.object({
  evaluation_ids: z.array(uuid).max(2000).optional(),
  application_ids: z.array(uuid).max(2000).optional(),
  select_all_filtered: z.coerce.boolean().optional(),
  university_id: uuid.optional(),
  opportunity_id: uuid.optional(),
  final_status: z.enum(['PASSED', 'FAILED', 'NOT_ELIGIBLE']).optional(),
  academic_year: z.string().max(20).optional(),
  student_name: z.string().max(200).optional(),
  university_number: z.string().max(80).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const commentsBodySchema = z.object({
  general_comments: z.string().max(8000),
});

const regenerateBodySchema = z.object({
  regeneration_reason: z.string().max(500).optional(),
});

module.exports = {
  universityQuerySchema,
  templateIdParamSchema,
  evaluationIdParamSchema,
  opportunityIdParamSchema,
  applicationIdParamSchema,
  uploadTemplateBodySchema,
  assignTemplateBodySchema,
  policyBodySchema,
  ratingBodySchema,
  reportListQuerySchema,
  generateBodySchema,
  zipBodySchema,
  commentsBodySchema,
  regenerateBodySchema,
};
