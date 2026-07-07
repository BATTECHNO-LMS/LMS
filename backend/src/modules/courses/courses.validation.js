const { z } = require('zod');

const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

const courseIdParamSchema = z.object({
  courseId: z.string().uuid(),
});

const sectionIdParamSchema = z.object({
  courseId: z.string().uuid(),
  sectionId: z.string().uuid(),
});

const lessonIdParamSchema = z.object({
  courseId: z.string().uuid(),
  lessonId: z.string().uuid(),
});

const courseLevelSchema = z.enum(['beginner', 'intermediate', 'advanced', 'all_levels']);
const courseStatusSchema = z.enum(['draft', 'published', 'archived']);
const lessonTypeSchema = z.enum(['video', 'text', 'link', 'file']);
const lessonStatusSchema = z.enum(['draft', 'published']);

const listAdminCoursesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: courseStatusSchema.optional(),
  level: courseLevelSchema.optional(),
});

const cohortIdsSchema = z.array(z.string().uuid()).max(100).optional();

const createCourseBodySchema = z.object({
  title: z.string().min(1).max(255),
  short_description: z.string().max(2000).optional().nullable(),
  description: z.string().max(50000).optional().nullable(),
  cover_image_url: z.string().max(2000).optional().nullable(),
  category: z.string().max(120).optional().nullable(),
  level: courseLevelSchema.optional(),
  estimated_duration_minutes: z.coerce.number().int().min(0).max(100000).optional().nullable(),
  cohort_ids: cohortIdsSchema,
});

const updateCourseBodySchema = createCourseBodySchema.partial();

const createSectionBodySchema = z.object({
  title: z.string().min(1).max(255),
  sort_order: z.coerce.number().int().min(0).optional(),
});

const updateSectionBodySchema = z.object({
  title: z.string().min(1).max(255).optional(),
  sort_order: z.coerce.number().int().min(0).optional(),
});

const createLessonBodySchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(10000).optional().nullable(),
  type: lessonTypeSchema,
  video_url: z.string().max(2000).optional().nullable(),
  content: z.string().max(100000).optional().nullable(),
  resource_url: z.string().max(2000).optional().nullable(),
  duration_minutes: z.coerce.number().int().min(0).max(10000).optional().nullable(),
  sort_order: z.coerce.number().int().min(0).optional(),
  is_preview: z.boolean().optional(),
  is_required: z.boolean().optional(),
  status: lessonStatusSchema.optional(),
});

const updateLessonBodySchema = createLessonBodySchema.partial();

const youtubePreviewBodySchema = z.object({
  url: z.string().min(3).max(2000),
});

const reorderLessonsBodySchema = z.object({
  items: z
    .array(
      z.object({
        lesson_id: z.string().uuid(),
        section_id: z.string().uuid(),
        sort_order: z.coerce.number().int().min(0),
      })
    )
    .min(1),
});

const listStudentCoursesQuerySchema = z.object({
  search: z.string().optional(),
  level: courseLevelSchema.optional(),
  category: z.string().optional(),
});

const lessonTrainingQuestionSchema = z.object({
  id: z.string().uuid().optional(),
  question_text: z.string().min(1).max(10000),
  code_snippet: z.string().max(20000).optional().nullable(),
  points: z.coerce.number().int().min(1).max(100).optional(),
  sort_order: z.coerce.number().int().min(0).optional(),
  expected_answer: z.string().max(5000).optional().nullable(),
});

const upsertLessonTrainingBodySchema = z.object({
  task_instructions: z.string().max(20000).optional().nullable(),
  task_file_url: z.string().max(2000).optional().nullable(),
  task_file_name: z.string().max(255).optional().nullable(),
  model_answer_url: z.string().max(2000).optional().nullable(),
  model_answer_name: z.string().max(255).optional().nullable(),
  correction_prompt: z.string().max(20000).optional().nullable(),
  max_score: z.coerce.number().int().min(1).max(1000).optional(),
  pass_score: z.coerce.number().int().min(0).max(1000).optional(),
  upload_weight: z.coerce.number().int().min(0).max(100).optional(),
  questions: z.array(lessonTrainingQuestionSchema).max(50).optional(),
});

const submitLessonAnswersBodySchema = z.object({
  answers: z
    .array(
      z.object({
        question_id: z.string().uuid(),
        answer_text: z.string().max(20000),
      })
    )
    .min(0)
    .max(50),
});

const submitLessonFileBodySchema = z.object({
  fileId: z.string().uuid().optional(),
});

module.exports = {
  uuidParamSchema,
  courseIdParamSchema,
  sectionIdParamSchema,
  lessonIdParamSchema,
  listAdminCoursesQuerySchema,
  createCourseBodySchema,
  updateCourseBodySchema,
  createSectionBodySchema,
  updateSectionBodySchema,
  createLessonBodySchema,
  updateLessonBodySchema,
  reorderLessonsBodySchema,
  youtubePreviewBodySchema,
  listStudentCoursesQuerySchema,
  upsertLessonTrainingBodySchema,
  submitLessonAnswersBodySchema,
  submitLessonFileBodySchema,
};
