const { z } = require('zod');

const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

const opportunityIdParamSchema = z.object({
  opportunityId: z.string().uuid(),
});

const applicationIdParamSchema = z.object({
  applicationId: z.string().uuid(),
});

const trainingModeSchema = z.enum(['onsite', 'remote', 'hybrid']);
const opportunityStatusSchema = z.enum(['draft', 'published', 'in_progress', 'archived']);
const applicationStatusSchema = z.enum(['pending', 'approved', 'rejected', 'cancelled']);

const optionalDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .nullable();

const submissionIdParamSchema = z.object({
  submissionId: z.string().uuid(),
});

const listAdminStatsQuerySchema = z.object({
  search: z.string().optional(),
  status: opportunityStatusSchema.optional(),
  training_mode: trainingModeSchema.optional(),
  specialty_id: z.string().uuid().optional(),
  from: optionalDateSchema,
  to: optionalDateSchema,
});

const listAdminQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: opportunityStatusSchema.optional(),
  training_mode: trainingModeSchema.optional(),
  specialty_id: z.string().uuid().optional(),
});

const opportunityBodySchema = z.object({
  title: z.string().min(1).max(255),
  specialty_id: z.string().uuid(),
  assigned_instructor_id: z.string().uuid().optional().nullable(),
  location: z.string().min(1).max(255),
  training_mode: trainingModeSchema,
  short_description: z.string().max(2000).optional().nullable(),
  description: z.string().max(50000).optional().nullable(),
  requirements: z.string().max(50000).optional().nullable(),
  benefits: z.string().max(50000).optional().nullable(),
  seats_limit: z.coerce.number().int().min(1).max(10000).optional().nullable(),
  start_date: optionalDateSchema,
  end_date: optionalDateSchema,
  application_deadline: optionalDateSchema,
  requires_pre_assessment: z.coerce.boolean().optional(),
  requires_post_assessment: z.coerce.boolean().optional(),
  requires_final_task: z.coerce.boolean().optional(),
  minimum_attendance_percentage: z.coerce.number().int().min(0).max(100).optional().nullable(),
  minimum_post_assessment_score: z.coerce.number().min(0).max(100).optional().nullable(),
  completion_rules: z.record(z.unknown()).optional().nullable(),
});

const updateOpportunityBodySchema = opportunityBodySchema.partial();

const applyBodySchema = z.object({
  student_message: z.string().max(5000).optional().nullable(),
});

const reviewApplicationBodySchema = z.object({
  status: z.enum(['approved', 'rejected']),
  admin_note: z.string().max(5000).optional().nullable(),
});

const listStudentQuerySchema = z.object({
  search: z.string().optional(),
  training_mode: trainingModeSchema.optional(),
});

const taskIdParamSchema = z.object({
  taskId: z.string().uuid(),
});

const taskBodySchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(10000).optional().nullable(),
  sort_order: z.coerce.number().int().min(0).max(10000).optional(),
  due_date: optionalDateSchema,
  ai_self_evaluation_prompt: z.string().max(20000).optional().nullable(),
  requires_ai_self_evaluation: z.coerce.boolean().optional(),
  is_final_task: z.coerce.boolean().optional(),
});

const updateTaskBodySchema = taskBodySchema.partial();

const sessionIdParamSchema = z.object({
  sessionId: z.string().uuid(),
});

const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);

const sessionBodySchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(10000).optional().nullable(),
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: timeSchema,
  end_time: timeSchema,
  zoom_link: z.string().url().max(2000).optional().nullable(),
  is_required: z.coerce.boolean().optional(),
});

const updateSessionBodySchema = sessionBodySchema.partial();

const attendanceRecordSchema = z.object({
  applicationId: z.string().uuid(),
  studentId: z.string().uuid(),
  status: z.enum(['present', 'absent', 'late', 'excused']),
  note: z.string().max(2000).optional().nullable(),
});

const saveAttendanceBodySchema = z.object({
  records: z.array(attendanceRecordSchema).min(1),
});

const assessmentTypeParamSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['pre', 'post']),
});

const assessmentQuestionSchema = z.object({
  question_text: z.string().min(1),
  question_type: z.enum(['multiple_choice', 'true_false', 'short_answer']),
  options: z.unknown().optional().nullable(),
  correct_answer: z.unknown().optional().nullable(),
  points: z.coerce.number().min(0).max(1000).optional(),
  sort_order: z.coerce.number().int().min(0).optional(),
});

const assessmentBodySchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(10000).optional().nullable(),
  passing_score: z.coerce.number().min(0).max(100).optional().nullable(),
  status: z.enum(['draft', 'published', 'closed']).optional(),
  questions: z.array(assessmentQuestionSchema).optional(),
});

const submitAssessmentBodySchema = z.object({
  answers: z.record(z.unknown()),
});

const expelBodySchema = z.object({
  reason: z.string().min(1).max(5000),
  allowReapply: z.coerce.boolean().optional(),
  notifyStudent: z.coerce.boolean().optional(),
});

const aiSelfEvalBodySchema = z.object({
  studentInput: z.string().min(1).max(20000),
});

const taskSubmitFieldsSchema = z.object({
  fileId: z.string().uuid().optional(),
  student_self_evaluation_input: z.string().max(20000).optional().nullable(),
  ai_prompt_used: z.string().max(20000).optional().nullable(),
  ai_model_provider: z.string().max(80).optional().nullable(),
  ai_model_name: z.string().max(120).optional().nullable(),
  ai_raw_response: z.string().max(100000).optional().nullable(),
  ai_response_inserted_text: z.string().max(100000).optional().nullable(),
  final_student_notes: z.string().max(10000).optional().nullable(),
});

const assessmentIdParamSchema = z.object({
  assessmentId: z.string().uuid(),
});

const createAssessmentBodySchema = assessmentBodySchema.extend({
  type: z.enum(['pre', 'post']),
});

const updateAssessmentBodySchema = assessmentBodySchema.partial();

const reviewSubmissionBodySchema = z.object({
  review_status: z.enum(['approved', 'rejected', 'needs_revision']),
  instructor_feedback: z.string().max(5000).optional().nullable(),
});

module.exports = {
  uuidParamSchema,
  opportunityIdParamSchema,
  applicationIdParamSchema,
  submissionIdParamSchema,
  taskIdParamSchema,
  sessionIdParamSchema,
  assessmentIdParamSchema,
  assessmentTypeParamSchema,
  taskBodySchema,
  updateTaskBodySchema,
  sessionBodySchema,
  updateSessionBodySchema,
  saveAttendanceBodySchema,
  assessmentBodySchema,
  createAssessmentBodySchema,
  updateAssessmentBodySchema,
  submitAssessmentBodySchema,
  reviewSubmissionBodySchema,
  expelBodySchema,
  aiSelfEvalBodySchema,
  taskSubmitFieldsSchema,
  listAdminQuerySchema,
  listAdminStatsQuerySchema,
  opportunityBodySchema,
  updateOpportunityBodySchema,
  applyBodySchema,
  reviewApplicationBodySchema,
  listStudentQuerySchema,
};
