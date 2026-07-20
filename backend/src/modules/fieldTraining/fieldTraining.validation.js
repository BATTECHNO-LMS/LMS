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

const listApplicationsQuerySchema = z.object({
  status: applicationStatusSchema.optional(),
  training_status: z
    .enum([
      'none',
      'pre_assessment_pending',
      'ready_for_training',
      'pre_assessment_completed',
      'in_training',
      'completed',
      'expelled',
    ])
    .optional(),
  university_id: z.string().uuid().optional(),
  university_specialty_id: z.string().uuid().optional(),
  specialty_id: z.string().uuid().optional(),
  search: z.string().optional(),
});

const listAdminQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: opportunityStatusSchema.optional(),
  training_mode: trainingModeSchema.optional(),
  specialty_id: z.string().uuid().optional(),
});

const eligibilityItemSchema = z.object({
  university_id: z.string().uuid(),
  university_specialty_id: z.string().uuid(),
  seats_limit: z.coerce.number().int().min(1).max(10000).optional().nullable(),
  is_active: z.coerce.boolean().optional(),
});

const opportunityBodySchema = z.object({
  title: z.string().min(1).max(255),
  specialty_id: z.string().uuid(),
  eligibility: z.array(eligibilityItemSchema).min(1),
  assigned_instructor_id: z.string().uuid().optional().nullable(),
  location: z.string().min(1).max(255),
  training_mode: trainingModeSchema,
  short_description: z.string().max(2000).optional().nullable(),
  description: z.string().max(50000).optional().nullable(),
  requirements: z.string().max(50000).optional().nullable(),
  benefits: z.string().max(50000).optional().nullable(),
  seats_limit: z.coerce.number().int().min(1).max(10000).optional().nullable(),
  required_training_hours: z.coerce
    .number({ invalid_type_error: 'عدد الساعات التدريبية المطلوبة يجب أن يكون رقمًا صحيحًا' })
    .int({ message: 'عدد الساعات التدريبية المطلوبة يجب أن يكون رقمًا صحيحًا' })
    .positive({ message: 'عدد الساعات التدريبية المطلوبة يجب أن يكون أكبر من صفر' })
    .max(10000, { message: 'عدد الساعات التدريبية المطلوبة كبير جدًا' }),
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

const updateOpportunityBodySchema = opportunityBodySchema.partial().extend({
  eligibility: z.array(eligibilityItemSchema).min(1).optional(),
  // Legacy opportunities may keep null; clearing is allowed on update only.
  required_training_hours: z.coerce
    .number({ invalid_type_error: 'عدد الساعات التدريبية المطلوبة يجب أن يكون رقمًا صحيحًا' })
    .int({ message: 'عدد الساعات التدريبية المطلوبة يجب أن يكون رقمًا صحيحًا' })
    .positive({ message: 'عدد الساعات التدريبية المطلوبة يجب أن يكون أكبر من صفر' })
    .max(10000, { message: 'عدد الساعات التدريبية المطلوبة كبير جدًا' })
    .optional()
    .nullable(),
});

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
  instruction_file_id: z.string().uuid().optional().nullable(),
  remove_instruction_file: z.coerce.boolean().optional(),
});

const updateTaskBodySchema = taskBodySchema.partial();

const sessionIdParamSchema = z.object({
  sessionId: z.string().uuid(),
});

function normalizeTimeValue(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return trimmed;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function normalizeOptionalUrl(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

const timeSchema = z.preprocess(
  (value) => normalizeTimeValue(value),
  z.string().regex(/^\d{2}:\d{2}$/, { message: 'Time must be in HH:MM format' })
);

const sessionDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Session date must be YYYY-MM-DD' });

const zoomLinkSchema = z.preprocess(
  (value) => normalizeOptionalUrl(value),
  z.union([z.string().url({ message: 'Invalid zoom link URL' }).max(2000), z.null()]).optional()
);

const sessionFieldsSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(10000).optional().nullable(),
  session_date: sessionDateSchema,
  start_time: timeSchema,
  end_time: timeSchema,
  zoom_link: zoomLinkSchema,
  is_required: z.coerce.boolean().optional(),
});

function refineSessionTimes(data, ctx) {
  if (!data.start_time || !data.end_time) return;
  const [sh, sm] = data.start_time.split(':').map(Number);
  const [eh, em] = data.end_time.split(':').map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  if (!(end > start)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['end_time'],
      message: 'وقت نهاية الجلسة يجب أن يكون بعد وقت البداية',
    });
  }
}

const sessionBodySchema = sessionFieldsSchema.superRefine(refineSessionTimes);
const updateSessionBodySchema = sessionFieldsSchema.partial().superRefine(refineSessionTimes);

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
  question_text: z.string().max(5000),
  question_type: z.enum([
    'multiple_choice',
    'true_false',
    'short_answer',
    'short_text',
    'long_text',
    'multi_select',
  ]),
  options: z.unknown().optional().nullable(),
  correct_answer: z.unknown().optional().nullable(),
  points: z.coerce.number().min(0).max(1000).optional(),
  is_required: z.coerce.boolean().optional(),
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

const requestExpulsionBodySchema = z.object({
  reason: z.string().trim().min(1).max(5000),
});

const aiSelfEvalBodySchema = z
  .object({
    studentDescription: z.string().trim().min(20).max(20000).optional(),
    /** @deprecated use studentDescription */
    studentInput: z.string().trim().min(20).max(20000).optional(),
    uploadedFileId: z.string().uuid().optional().nullable(),
    projectUrl: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .nullable()
      .refine((v) => v == null || v === '' || /^https?:\/\//i.test(v), {
        message: 'الرابط يجب أن يبدأ بـ http:// أو https://',
      }),
  })
  .superRefine((data, ctx) => {
    const description = (data.studentDescription || data.studentInput || '').trim();
    if (description.length < 20) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'يجب كتابة وصف لما أنجزته (20 حرفًا على الأقل)',
        path: ['studentDescription'],
      });
    }
    const hasFile = Boolean(data.uploadedFileId);
    const hasUrl = Boolean(data.projectUrl?.trim());
    if (!hasFile && !hasUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'أرفق ملفًا أو أدخل رابطًا عامًا للعمل مع الوصف',
        path: ['uploadedFileId'],
      });
    }
  });

const taskSubmitFieldsSchema = z.object({
  fileId: z.string().uuid().optional().nullable(),
  project_url: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .refine((v) => v == null || v === '' || /^https?:\/\//i.test(v), {
      message: 'الرابط يجب أن يبدأ بـ http:// أو https://',
    }),
  student_self_evaluation_input: z.string().max(20000).optional().nullable(),
  ai_prompt_used: z.string().max(50000).optional().nullable(),
  ai_model_provider: z.string().max(80).optional().nullable(),
  ai_model_name: z.string().max(120).optional().nullable(),
  ai_raw_response: z.string().max(100000).optional().nullable(),
  ai_response_inserted_text: z.string().max(100000).optional().nullable(),
  final_student_notes: z.string().max(10000).optional().nullable(),
  analysis_file_id: z.string().uuid().optional().nullable(),
  file_extraction_status: z.string().max(40).optional().nullable(),
  file_extracted_text: z.string().max(100000).optional().nullable(),
  url_extraction_status: z.string().max(40).optional().nullable(),
  url_extracted_text: z.string().max(100000).optional().nullable(),
  extraction_errors: z.string().max(10000).optional().nullable(),
  ai_evaluated_at: z
    .union([z.string().datetime(), z.string().min(1), z.null()])
    .optional()
    .nullable(),
});

const assessmentIdParamSchema = z.object({
  assessmentId: z.string().uuid(),
});

const attemptIdParamSchema = z.object({
  attemptId: z.string().uuid(),
});

const gradeAttemptBodySchema = z.object({
  grades: z
    .array(
      z.object({
        question_id: z.string().uuid(),
        awarded_points: z.coerce.number().min(0),
      })
    )
    .min(1),
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
  attemptIdParamSchema,
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
  gradeAttemptBodySchema,
  reviewSubmissionBodySchema,
  expelBodySchema,
  requestExpulsionBodySchema,
  aiSelfEvalBodySchema,
  taskSubmitFieldsSchema,
  listAdminQuerySchema,
  listApplicationsQuerySchema,
  listAdminStatsQuerySchema,
  opportunityBodySchema,
  updateOpportunityBodySchema,
  applyBodySchema,
  reviewApplicationBodySchema,
  listStudentQuerySchema,
};
