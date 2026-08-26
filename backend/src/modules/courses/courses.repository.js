const { prisma } = require('../../config/db');
const { resolvePublicUrl } = require('../../shared/storage/fileStorage');

const courseIncludeStructure = {
  course_sections: {
    orderBy: { sort_order: 'asc' },
    include: {
      course_lessons: { orderBy: { sort_order: 'asc' } },
    },
  },
};

const courseIncludeStructurePublishedLessons = {
  course_sections: {
    orderBy: { sort_order: 'asc' },
    include: {
      course_lessons: {
        where: { status: 'published' },
        orderBy: { sort_order: 'asc' },
      },
    },
  },
};

function countLessons(course) {
  const sections = course.course_sections || [];
  return sections.reduce((n, s) => n + (s.course_lessons?.length || 0), 0);
}

const courseCohortsInclude = {
  course_cohorts: {
    include: {
      cohorts: { select: { id: true, title: true, status: true } },
    },
  },
};

function mapCourseCohorts(course) {
  const links = course.course_cohorts || [];
  return links.map((link) => ({
    id: link.cohorts?.id ?? link.cohort_id,
    title: link.cohorts?.title ?? '',
    status: link.cohorts?.status ?? null,
  }));
}

function mapCourseListRow(course) {
  const sections = course.course_sections || [];
  const lessonsCount = sections.reduce((n, s) => n + (s._count?.course_lessons ?? s.course_lessons?.length ?? 0), 0);
  const cohorts = mapCourseCohorts(course);
  return {
    id: course.id,
    title: course.title,
    slug: course.slug,
    short_description: course.short_description,
    level: course.level,
    status: course.status,
    category: course.category,
    cover_image_url: resolvePublicUrl(course.cover_image_url),
    estimated_duration_minutes: course.estimated_duration_minutes,
    published_at: course.published_at,
    created_at: course.created_at,
    updated_at: course.updated_at,
    sections_count: course._count?.course_sections ?? sections.length,
    lessons_count: lessonsCount,
    cohorts,
    cohort_ids: cohorts.map((c) => c.id),
  };
}

async function findManyAdmin({ where, skip, take }) {
  const [rows, total] = await Promise.all([
    prisma.courses.findMany({
      where,
      skip,
      take,
      orderBy: { updated_at: 'desc' },
      include: {
        _count: { select: { course_sections: true } },
        course_sections: {
          select: { _count: { select: { course_lessons: true } } },
        },
        ...courseCohortsInclude,
      },
    }),
    prisma.courses.count({ where }),
  ]);
  return { courses: rows.map(mapCourseListRow), total };
}

async function findById(id, { publishedLessonsOnly = false } = {}) {
  return prisma.courses.findUnique({
    where: { id },
    include: {
      ...(publishedLessonsOnly ? courseIncludeStructurePublishedLessons : courseIncludeStructure),
      ...courseCohortsInclude,
    },
  });
}

async function findPublishedById(id) {
  return prisma.courses.findFirst({
    where: { id, status: 'published' },
    include: courseIncludeStructurePublishedLessons,
  });
}

async function findStudentCohortIds(studentId) {
  const rows = await prisma.enrollments.findMany({
    where: {
      student_id: studentId,
      enrollment_status: { in: ['enrolled', 'completed'] },
    },
    select: { cohort_id: true },
  });
  return [...new Set(rows.map((r) => r.cohort_id))];
}

function buildStudentCohortVisibilityFilter(cohortIds) {
  if (!cohortIds.length) {
    return { course_cohorts: { none: {} } };
  }
  return {
    OR: [
      { course_cohorts: { none: {} } },
      { course_cohorts: { some: { cohort_id: { in: cohortIds } } } },
    ],
  };
}

async function findPublishedManyForStudent({ where }, studentId) {
  const cohortIds = await findStudentCohortIds(studentId);
  return prisma.courses.findMany({
    where: {
      ...where,
      status: 'published',
      ...buildStudentCohortVisibilityFilter(cohortIds),
    },
    orderBy: { published_at: 'desc' },
    include: {
      _count: { select: { course_sections: true } },
      ...courseCohortsInclude,
    },
  });
}

async function countCourseCohortLinks(courseId) {
  return prisma.course_cohorts.count({ where: { course_id: courseId } });
}

async function findCourseCohortIds(courseId) {
  const rows = await prisma.course_cohorts.findMany({
    where: { course_id: courseId },
    select: { cohort_id: true },
  });
  return rows.map((r) => r.cohort_id);
}

async function setCourseCohorts(courseId, cohortIds) {
  const uniqueIds = [...new Set(cohortIds)];
  await prisma.$transaction([
    prisma.course_cohorts.deleteMany({ where: { course_id: courseId } }),
    ...(uniqueIds.length
      ? [
          prisma.course_cohorts.createMany({
            data: uniqueIds.map((cohort_id) => ({ course_id: courseId, cohort_id })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);
}

async function studentCanAccessCourse(courseId, studentId) {
  const linkCount = await countCourseCohortLinks(courseId);
  if (linkCount === 0) return true;
  const cohortIds = await findStudentCohortIds(studentId);
  if (!cohortIds.length) return false;
  const match = await prisma.course_cohorts.findFirst({
    where: { course_id: courseId, cohort_id: { in: cohortIds } },
    select: { cohort_id: true },
  });
  return Boolean(match);
}

async function findPublishedByIdForStudent(id, studentId) {
  const canAccess = await studentCanAccessCourse(id, studentId);
  if (!canAccess) return null;
  return findPublishedById(id);
}

async function createCourse(data) {
  return prisma.courses.create({ data });
}

async function updateCourse(id, data) {
  return prisma.courses.update({ where: { id }, data });
}

async function slugExists(slug, excludeId) {
  const row = await prisma.courses.findFirst({
    where: {
      slug,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  return Boolean(row);
}

async function createSection(courseId, data) {
  return prisma.course_sections.create({
    data: { course_id: courseId, ...data },
  });
}

async function updateSection(sectionId, data) {
  return prisma.course_sections.update({
    where: { id: sectionId },
    data,
  });
}

async function deleteSection(sectionId) {
  return prisma.course_sections.delete({ where: { id: sectionId } });
}

async function findSectionInCourse(courseId, sectionId) {
  return prisma.course_sections.findFirst({
    where: { id: sectionId, course_id: courseId },
  });
}

async function createLesson(courseId, sectionId, data) {
  return prisma.course_lessons.create({
    data: {
      course_id: courseId,
      section_id: sectionId,
      ...data,
    },
  });
}

async function updateLesson(lessonId, data) {
  return prisma.course_lessons.update({ where: { id: lessonId }, data });
}

async function deleteLesson(lessonId) {
  return prisma.course_lessons.delete({ where: { id: lessonId } });
}

async function findLessonInCourse(courseId, lessonId) {
  return prisma.course_lessons.findFirst({
    where: { id: lessonId, course_id: courseId },
  });
}

async function reorderLessons(courseId, items) {
  return prisma.$transaction(
    items.map((item) =>
      prisma.course_lessons.updateMany({
        where: { id: item.lesson_id, course_id: courseId },
        data: { section_id: item.section_id, sort_order: item.sort_order },
      })
    )
  );
}

async function findEnrollment(courseId, studentId) {
  return prisma.course_enrollments.findUnique({
    where: {
      course_id_student_id: { course_id: courseId, student_id: studentId },
    },
  });
}

async function findEnrollmentsForStudentCourses(studentId, courseIds) {
  if (!courseIds.length) return [];
  return prisma.course_enrollments.findMany({
    where: { student_id: studentId, course_id: { in: courseIds } },
  });
}

async function upsertEnrollment(courseId, studentId) {
  return prisma.course_enrollments.upsert({
    where: {
      course_id_student_id: { course_id: courseId, student_id: studentId },
    },
    create: {
      course_id: courseId,
      student_id: studentId,
      status: 'active',
    },
    update: {},
  });
}

async function markEnrollmentCompleted(enrollmentId) {
  return prisma.course_enrollments.update({
    where: { id: enrollmentId },
    data: { status: 'completed', completed_at: new Date() },
  });
}

async function findProgressForCourse(courseId, studentId) {
  return prisma.course_lesson_progress.findMany({
    where: { course_id: courseId, student_id: studentId },
  });
}

async function upsertLessonComplete(courseId, lessonId, studentId) {
  return prisma.course_lesson_progress.upsert({
    where: {
      lesson_id_student_id: { lesson_id: lessonId, student_id: studentId },
    },
    create: {
      course_id: courseId,
      lesson_id: lessonId,
      student_id: studentId,
      is_completed: true,
      completed_at: new Date(),
    },
    update: {
      is_completed: true,
      completed_at: new Date(),
    },
  });
}

async function countPublishedLessons(courseId) {
  return prisma.course_lessons.count({
    where: { course_id: courseId, status: 'published' },
  });
}

async function countPublishedLessonsByCourseIds(courseIds) {
  const unique = [...new Set((courseIds || []).filter(Boolean))];
  if (!unique.length) return [];
  return prisma.course_lessons.groupBy({
    by: ['course_id'],
    where: { course_id: { in: unique }, status: 'published' },
    _count: { _all: true },
  });
}

async function countCompletedLessonsByCourseIds(courseIds, studentId) {
  const unique = [...new Set((courseIds || []).filter(Boolean))];
  if (!unique.length) return [];
  return prisma.course_lesson_progress.groupBy({
    by: ['course_id'],
    where: { course_id: { in: unique }, student_id: studentId, is_completed: true },
    _count: { _all: true },
  });
}

module.exports = {
  courseIncludeStructure,
  countLessons,
  mapCourseListRow,
  findManyAdmin,
  findById,
  findPublishedById,
  findPublishedManyForStudent,
  findStudentCohortIds,
  setCourseCohorts,
  findCourseCohortIds,
  studentCanAccessCourse,
  findPublishedByIdForStudent,
  mapCourseCohorts,
  createCourse,
  updateCourse,
  slugExists,
  createSection,
  updateSection,
  deleteSection,
  findSectionInCourse,
  createLesson,
  updateLesson,
  deleteLesson,
  findLessonInCourse,
  reorderLessons,
  findEnrollment,
  findEnrollmentsForStudentCourses,
  upsertEnrollment,
  markEnrollmentCompleted,
  findProgressForCourse,
  upsertLessonComplete,
  countPublishedLessons,
  countPublishedLessonsByCourseIds,
  countCompletedLessonsByCourseIds,
};
