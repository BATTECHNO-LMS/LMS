const { prisma } = require('../../config/db');

async function findLessonInCourse(lessonId, courseId) {
  return prisma.course_lessons.findFirst({
    where: { id: lessonId, course_id: courseId, status: 'published' },
  });
}

async function findLessonAny(lessonId, courseId) {
  return prisma.course_lessons.findFirst({
    where: { id: lessonId, course_id: courseId },
  });
}

async function findTraining(lessonId) {
  return prisma.course_lesson_training.findUnique({
    where: { lesson_id: lessonId },
    include: {
      course_lessons: {
        select: {
          id: true,
          title: true,
          type: true,
          video_url: true,
          resource_url: true,
          description: true,
        },
      },
    },
  });
}

async function findQuestions(lessonId) {
  return prisma.course_lesson_questions.findMany({
    where: { lesson_id: lessonId },
    orderBy: { sort_order: 'asc' },
  });
}

async function upsertTraining(lessonId, data) {
  return prisma.course_lesson_training.upsert({
    where: { lesson_id: lessonId },
    create: { lesson_id: lessonId, ...data },
    update: data,
  });
}

async function replaceQuestions(lessonId, questions) {
  await prisma.course_lesson_questions.deleteMany({ where: { lesson_id: lessonId } });
  if (!questions?.length) return [];
  await prisma.course_lesson_questions.createMany({
    data: questions.map((q, i) => ({
      lesson_id: lessonId,
      question_text: q.question_text,
      code_snippet: q.code_snippet ?? null,
      points: q.points ?? 5,
      sort_order: q.sort_order ?? i,
      expected_answer: q.expected_answer ?? null,
    })),
  });
  return findQuestions(lessonId);
}

async function findWorkflow(lessonId, studentId) {
  return prisma.course_lesson_student_workflow.findUnique({
    where: { lesson_id_student_id: { lesson_id: lessonId, student_id: studentId } },
  });
}

async function upsertWorkflow(lessonId, studentId, courseId, data) {
  return prisma.course_lesson_student_workflow.upsert({
    where: { lesson_id_student_id: { lesson_id: lessonId, student_id: studentId } },
    create: { lesson_id: lessonId, student_id: studentId, course_id: courseId, ...data },
    update: data,
  });
}

module.exports = {
  findLessonInCourse,
  findLessonAny,
  findTraining,
  findQuestions,
  upsertTraining,
  replaceQuestions,
  findWorkflow,
  upsertWorkflow,
};
