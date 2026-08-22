'use strict';

const { z } = require('zod');

const uuidParam = z.object({ id: z.string().uuid() });
const orgIdParam = z.object({ organizationId: z.string().uuid() });
const programIdParam = z.object({ programId: z.string().uuid() });
const cohortIdParam = z.object({ cohortId: z.string().uuid() });
const sessionIdParam = z.object({ sessionId: z.string().uuid() });
const taskIdParam = z.object({ taskId: z.string().uuid() });
const taskResubmitParam = z.object({ taskId: z.string().uuid(), submissionId: z.string().uuid() });
const assessmentIdParam = z.object({ assessmentId: z.string().uuid() });
const attemptIdParam = z.object({ attemptId: z.string().uuid() });
const enrollmentIdParam = z.object({ enrollmentId: z.string().uuid() });
const submissionIdParam = z.object({ submissionId: z.string().uuid() });
const responseIdParam = z.object({ responseId: z.string().uuid() });
const evaluationAssignmentIdParam = z.object({ assignmentId: z.string().uuid() });
const assessmentKindParam = z.object({
  programId: z.string().uuid(),
  kind: z.enum(['pre', 'post', 'PRE_TEST', 'POST_TEST']),
});

const listCoursesQuery = z.object({
  organizationId: z.string().uuid().optional(),
  status: z
    .enum([
      'DRAFT',
      'PUBLISHED',
      'REGISTRATION_OPEN',
      'REGISTRATION_CLOSED',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED',
      'ARCHIVED',
    ])
    .optional(),
});

const programStatusEnum = z.enum([
  'DRAFT',
  'PUBLISHED',
  'REGISTRATION_OPEN',
  'REGISTRATION_CLOSED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED',
]);

const createProgramBody = z
  .object({
    title: z.string().trim().min(2).max(255),
    description: z.string().optional().nullable(),
    short_description: z.string().optional().nullable(),
    field: z.string().optional().nullable(),
    objectives: z.string().optional().nullable(),
    outcomes: z.string().optional().nullable(),
    level: z.string().optional().nullable(),
    language: z.string().optional().nullable(),
    delivery_mode: z.string().optional().nullable(),
    required_hours: z.coerce.number().optional().nullable(),
    required_attendance_pct: z.coerce.number().optional().nullable(),
    max_participants: z.coerce.number().int().optional().nullable(),
    expected_sessions: z.coerce.number().int().optional().nullable(),
    timezone: z.string().optional().nullable(),
    start_date: z.string().optional().nullable(),
    end_date: z.string().optional().nullable(),
    pass_score: z.coerce.number().optional().nullable(),
    requires_pre_test: z.boolean().optional(),
    requires_post_test: z.boolean().optional(),
    requires_tasks: z.boolean().optional(),
    requires_final_task: z.boolean().optional(),
    requires_evaluation: z.boolean().optional(),
    status: programStatusEnum.optional(),
    // Reject attempts to create university field-training via institution UI.
    type: z.undefined().optional(),
  })
  .strict();

const updateProgramBody = z
  .object({
    title: z.string().trim().min(2).max(255).optional(),
    title_en: z.string().trim().max(255).optional().nullable(),
    description: z.string().optional().nullable(),
    short_description: z.string().optional().nullable(),
    field: z.string().optional().nullable(),
    domains: z.union([z.array(z.string()), z.string()]).optional().nullable(),
    objectives: z.string().optional().nullable(),
    outcomes: z.string().optional().nullable(),
    level: z.string().optional().nullable(),
    language: z.string().optional().nullable(),
    delivery_mode: z.string().optional().nullable(),
    target_audience: z.string().optional().nullable(),
    prerequisites: z.string().optional().nullable(),
    venue: z.string().optional().nullable(),
    meeting_url: z.string().optional().nullable(),
    online_meeting: z.string().optional().nullable(),
    required_hours: z.coerce.number().optional().nullable(),
    required_attendance_pct: z.coerce.number().optional().nullable(),
    max_participants: z.coerce.number().int().optional().nullable(),
    expected_sessions: z.coerce.number().int().optional().nullable(),
    start_date: z.string().optional().nullable(),
    end_date: z.string().optional().nullable(),
    registration_open_at: z.string().optional().nullable(),
    registration_close_at: z.string().optional().nullable(),
    enrollment_open: z.boolean().optional().nullable(),
    visibility: z.string().optional().nullable(),
    timezone: z.string().optional().nullable(),
    pass_score: z.coerce.number().optional().nullable(),
    requires_pre_test: z.boolean().optional(),
    requires_post_test: z.boolean().optional(),
    requires_tasks: z.boolean().optional(),
    requires_final_task: z.boolean().optional(),
    requires_evaluation: z.boolean().optional(),
    status: programStatusEnum.optional(),
    type: z.undefined().optional(),
  })
  .strict();

const materialIdParam = z.object({ materialId: z.string().uuid() });
const lectureIdParam = z.object({ lectureId: z.string().uuid() });

const materialBody = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  material_type: z.string().max(40).optional(),
  url: z.string().max(2000).optional().nullable(),
  storage_key: z.string().max(500).optional().nullable(),
  file_id: z.string().uuid().optional().nullable(),
  mime_type: z.string().max(120).optional().nullable(),
  visibility: z.string().max(40).optional(),
  is_published: z.boolean().optional(),
  sort_order: z.coerce.number().int().optional(),
  cohort_id: z.string().uuid().optional().nullable(),
  session_id: z.string().uuid().optional().nullable(),
  meta: z.record(z.string(), z.any()).optional().nullable(),
});

const createMaterialBody = materialBody.extend({
  title: z.string().trim().min(1).max(255),
});

const recordedLectureBody = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  url: z.string().max(2000).optional().nullable(),
  external_url: z.string().max(2000).optional().nullable(),
  storage_key: z.string().max(500).optional().nullable(),
  file_id: z.string().uuid().optional().nullable(),
  mime_type: z.string().max(120).optional().nullable(),
  duration_seconds: z.coerce.number().int().optional().nullable(),
  available_from: z.string().optional().nullable(),
  visibility: z.string().max(40).optional(),
  is_published: z.boolean().optional(),
  publish: z.boolean().optional(),
  unpublish: z.boolean().optional(),
  sort_order: z.coerce.number().int().optional(),
  cohort_id: z.string().uuid().optional().nullable(),
  session_id: z.string().uuid().optional().nullable(),
  thumbnail_url: z.string().max(2000).optional().nullable(),
  meta: z.record(z.string(), z.any()).optional().nullable(),
});

const createRecordedLectureBody = recordedLectureBody.extend({
  title: z.string().trim().min(1).max(255),
});

const publishLectureBody = z.object({
  publish: z.boolean().optional(),
  unpublish: z.boolean().optional(),
});

const createTaskBody = z.object({
  title: z.string().trim().min(1).max(255),
  instructions: z.string().optional().nullable(),
  max_score: z.coerce.number().optional().nullable(),
  grading_mode: z.string().max(20).optional(),
  is_final_task: z.boolean().optional(),
  is_required: z.boolean().optional(),
  allow_resubmit: z.boolean().optional(),
  max_attempts: z.coerce.number().int().optional(),
  publish: z.boolean().optional(),
  due_at: z.string().optional().nullable(),
  cohort_id: z.string().uuid().optional().nullable(),
  external_links: z.array(z.string()).optional(),
  allowed_file_types: z.array(z.string()).optional(),
  attachment_url: z.string().optional().nullable(),
  attachment_storage_key: z.string().optional().nullable(),
  attachment_file_id: z.string().uuid().optional().nullable(),
  settings: z.record(z.string(), z.any()).optional(),
});

const updateTaskBody = createTaskBody
  .partial()
  .extend({
    title: z.string().trim().min(1).max(255).optional(),
    publish: z.boolean().optional(),
    unpublish: z.boolean().optional(),
    published_at: z.string().optional().nullable(),
    acknowledge_submissions_impact: z.boolean().optional(),
  })
  .strict();

const createCohortBody = z.object({
  name: z.string().trim().min(1).max(255),
  branch_id: z.string().uuid().optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  capacity: z.coerce.number().int().optional().nullable(),
  delivery_mode: z.string().optional().nullable(),
  status: z.enum(['DRAFT', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ARCHIVED']).optional(),
  instructor_ids: z.array(z.string().uuid()).optional(),
  trainer_ids: z.array(z.string().uuid()).optional(),
});

const enrollBody = z.object({
  user_id: z.string().uuid(),
  invite: z.boolean().optional(),
  status: z
    .enum([
      'INVITED',
      'PENDING',
      'APPROVED',
      'REJECTED',
      'NEEDS_UPDATE',
      'ACTIVE',
      'WITHDRAWN',
      'REQUIREMENTS_COMPLETED',
      'COMPLETED',
      'NOT_COMPLETED',
    ])
    .optional(),
  status_reason: z.string().optional().nullable(),
});

const importBody = z.object({
  rows: z.array(
    z.object({
      email: z.string(),
      full_name: z.string().optional(),
      phone: z.string().optional(),
      employee_number: z.string().optional(),
      branch: z.string().optional(),
      department: z.string().optional(),
      job_title: z.string().optional(),
    })
  ),
});

const sessionBody = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().optional().nullable(),
  instructor_id: z.string().uuid().optional().nullable(),
  starts_at: z.string(),
  ends_at: z.string(),
  hours: z.number().optional().nullable(),
  session_type: z.string().optional().nullable(),
  meeting_url: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  attendance_required: z.boolean().optional(),
  counts_toward_hours: z.boolean().optional(),
  status: z.enum(['SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED', 'RESCHEDULED']).optional(),
});

const updateSessionBody = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
  hours: z.number().optional().nullable(),
  session_type: z.string().optional().nullable(),
  meeting_url: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  attendance_required: z.boolean().optional(),
  status: z.enum(['SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED', 'RESCHEDULED']).optional(),
});

const setAttendanceStatusBody = z.object({
  enrollment_id: z.string().uuid(),
  status: z.enum(['present', 'absent', 'late', 'excused', 'PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
  note: z.string().max(1000).optional().nullable(),
  reason: z.string().max(1000).optional().nullable(),
});

const evaluationAnswersBody = z.object({
  answers: z.record(z.string(), z.any()).optional(),
});

const reopenEvaluationBody = z.object({
  reason: z.string().trim().min(3).max(2000),
});

const cohortIdQuery = z.object({ cohortId: z.string().uuid().optional() });

const finalizeTrainingBody = z.object({
  cohortId: z.string().uuid().optional().nullable(),
  enrollmentIds: z.array(z.string().uuid()).optional(),
  mode: z.enum(['ELIGIBLE_ONLY', 'EXCEPTIONAL']).optional(),
  reason: z.string().trim().max(2000).optional().nullable(),
});

const reopenTrainingBody = z.object({
  reason: z.string().trim().min(3).max(2000),
  enrollmentIds: z.array(z.string().uuid()).optional(),
});

const reportIdParam = z.object({ reportId: z.string().uuid() });
const verificationCodeParam = z.object({ verificationCode: z.string().min(8).max(128) });

const reportTypeEnum = z.enum([
  'INDIVIDUAL',
  'COURSE',
  'COHORT',
  'TRAINER',
  'EVALUATION',
  'ATTENDANCE',
  'LEARNING_IMPACT',
  'CERTIFICATES',
]);

const generateOfficialReportBody = z.object({
  reportType: reportTypeEnum,
  cohortId: z.string().uuid().optional().nullable(),
  trainerUserId: z.string().uuid().optional().nullable(),
  mode: z.enum(['ELIGIBLE_ONLY', 'EXCEPTIONAL']).optional().nullable(),
  reason: z.string().trim().max(2000).optional().nullable(),
});

const listOfficialReportsQuery = z.object({
  reportType: reportTypeEnum.optional(),
  cohortId: z.string().uuid().optional(),
  trainerUserId: z.string().uuid().optional(),
});

const generateCohortReportBody = z.object({
  reportType: reportTypeEnum.optional().default('COHORT'),
  trainerUserId: z.string().uuid().optional().nullable(),
});

module.exports = {
  uuidParam,
  orgIdParam,
  programIdParam,
  cohortIdParam,
  sessionIdParam,
  taskIdParam,
  taskResubmitParam,
  assessmentIdParam,
  attemptIdParam,
  assessmentKindParam,
  enrollmentIdParam,
  submissionIdParam,
  responseIdParam,
  evaluationAssignmentIdParam,
  listCoursesQuery,
  createProgramBody,
  updateProgramBody,
  createCohortBody,
  enrollBody,
  importBody,
  sessionBody,
  updateSessionBody,
  setAttendanceStatusBody,
  evaluationAnswersBody,
  reopenEvaluationBody,
  cohortIdQuery,
  finalizeTrainingBody,
  reopenTrainingBody,
  reportIdParam,
  verificationCodeParam,
  reportTypeEnum,
  generateOfficialReportBody,
  generateCohortReportBody,
  listOfficialReportsQuery,
  materialIdParam,
  lectureIdParam,
  materialBody,
  createMaterialBody,
  recordedLectureBody,
  createRecordedLectureBody,
  publishLectureBody,
  createTaskBody,
  updateTaskBody,
};
