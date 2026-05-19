const { ApiError } = require('../../utils/apiError');
const { recordAudit } = require('../../utils/auditRecorder');
const { uniqueSlugFromTitle } = require('./courses.slug');
const { assertPublishReady } = require('./courses.publishReadiness');
const { prisma } = require('../../config/db');
const repo = require('./courses.repository');

async function assertCohortIdsExist(cohortIds) {
  if (!cohortIds?.length) return;
  const unique = [...new Set(cohortIds)];
  const count = await prisma.cohorts.count({ where: { id: { in: unique } } });
  if (count !== unique.length) {
    throw new ApiError(400, 'واحدة أو أكثر من الدفعات غير موجودة');
  }
}

async function syncCourseCohorts(courseId, cohortIds) {
  if (cohortIds === undefined) return;
  const ids = Array.isArray(cohortIds) ? cohortIds : [];
  await assertCohortIdsExist(ids);
  await repo.setCourseCohorts(courseId, ids);
}

function buildAdminWhere(query) {
  const where = {};
  if (query.status) where.status = query.status;
  if (query.level) where.level = query.level;
  if (query.search) {
    const s = query.search.trim();
    if (s) {
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { description: { contains: s, mode: 'insensitive' } },
        { short_description: { contains: s, mode: 'insensitive' } },
      ];
    }
  }
  return where;
}

function mapStructure(course) {
  return {
    course: {
      id: course.id,
      title: course.title,
      slug: course.slug,
      status: course.status,
      level: course.level,
    },
    sections: (course.course_sections || []).map((s) => ({
      id: s.id,
      title: s.title,
      sort_order: s.sort_order,
      lessons: (s.course_lessons || []).map((l) => ({
        id: l.id,
        section_id: l.section_id,
        title: l.title,
        description: l.description,
        type: l.type,
        video_url: l.video_url,
        content: l.content,
        resource_url: l.resource_url,
        duration_minutes: l.duration_minutes,
        sort_order: l.sort_order,
        is_preview: l.is_preview,
        is_required: l.is_required,
        status: l.status,
      })),
    })),
  };
}

async function listAdminCourses(query) {
  const page = query.page;
  const page_size = query.page_size;
  const skip = (page - 1) * page_size;
  const { courses, total } = await repo.findManyAdmin({
    where: buildAdminWhere(query),
    skip,
    take: page_size,
  });
  const total_pages = Math.max(1, Math.ceil(total / page_size));
  return {
    courses,
    meta: { page, page_size, total, total_pages },
  };
}

async function getAdminCourseById(id) {
  const course = await repo.findById(id);
  if (!course) throw new ApiError(404, 'Course not found');
  const mapped = repo.mapCourseListRow({
    ...course,
    _count: { course_sections: course.course_sections.length },
  });
  return {
    course: {
      ...mapped,
      description: course.description,
      short_description: course.short_description,
      cover_image_url: course.cover_image_url,
      slug: course.slug,
      created_by_id: course.created_by_id,
    },
  };
}

async function createAdminCourse(body, userId) {
  const slug = await uniqueSlugFromTitle(body.title, (s) => repo.slugExists(s));
  const course = await repo.createCourse({
    title: body.title.trim(),
    slug,
    short_description: body.short_description ?? null,
    description: body.description ?? null,
    cover_image_url: body.cover_image_url || null,
    category: body.category ?? null,
    level: body.level ?? 'beginner',
    status: 'draft',
    estimated_duration_minutes: body.estimated_duration_minutes ?? null,
    created_by_id: userId,
  });
  await syncCourseCohorts(course.id, body.cohort_ids);
  await recordAudit({
    userId,
    actionType: 'COURSE_CREATED',
    entityType: 'course',
    entityId: course.id,
    newValues: { title: course.title, status: course.status },
  });
  const full = await repo.findById(course.id);
  return { course: repo.mapCourseListRow({ ...full, _count: { course_sections: full.course_sections?.length ?? 0 } }) };
}

async function updateAdminCourse(id, body, userId) {
  const existing = await repo.findById(id);
  if (!existing) throw new ApiError(404, 'Course not found');

  const data = {};
  if (body.title != null) {
    data.title = body.title.trim();
    if (body.title.trim() !== existing.title) {
      data.slug = await uniqueSlugFromTitle(body.title, (s) => repo.slugExists(s, id));
    }
  }
  if (body.short_description !== undefined) data.short_description = body.short_description;
  if (body.description !== undefined) data.description = body.description;
  if (body.cover_image_url !== undefined) data.cover_image_url = body.cover_image_url || null;
  if (body.category !== undefined) data.category = body.category;
  if (body.level !== undefined) data.level = body.level;
  if (body.estimated_duration_minutes !== undefined) {
    data.estimated_duration_minutes = body.estimated_duration_minutes;
  }

  const course = await repo.updateCourse(id, data);
  await syncCourseCohorts(id, body.cohort_ids);
  await recordAudit({
    userId,
    actionType: 'COURSE_UPDATED',
    entityType: 'course',
    entityId: id,
    oldValues: { title: existing.title },
    newValues: data,
  });
  return { course };
}

async function publishCourse(id, userId) {
  const course = await repo.findById(id);
  if (!course) throw new ApiError(404, 'Course not found');
  assertPublishReady(course);
  const { prisma } = require('../../config/db');
  const updated = await prisma.$transaction(async (tx) => {
    await tx.course_lessons.updateMany({
      where: { course_id: id },
      data: { status: 'published' },
    });
    return tx.courses.update({
      where: { id },
      data: { status: 'published', published_at: new Date() },
    });
  });
  await recordAudit({
    userId,
    actionType: 'COURSE_PUBLISHED',
    entityType: 'course',
    entityId: id,
    newValues: { status: 'published' },
  });
  return { course: updated };
}

async function archiveCourse(id, userId) {
  const course = await repo.findById(id);
  if (!course) throw new ApiError(404, 'Course not found');
  const updated = await repo.updateCourse(id, { status: 'archived' });
  await recordAudit({
    userId,
    actionType: 'COURSE_ARCHIVED',
    entityType: 'course',
    entityId: id,
    newValues: { status: 'archived' },
  });
  return { course: updated };
}

async function getCourseStructure(courseId) {
  const course = await repo.findById(courseId);
  if (!course) throw new ApiError(404, 'Course not found');
  return mapStructure(course);
}

async function createSection(courseId, body) {
  const course = await repo.findById(courseId);
  if (!course) throw new ApiError(404, 'Course not found');
  const maxOrder = (course.course_sections || []).reduce((m, s) => Math.max(m, s.sort_order), -1);
  const section = await repo.createSection(courseId, {
    title: body.title.trim(),
    sort_order: body.sort_order ?? maxOrder + 1,
  });
  return { section };
}

async function updateSection(courseId, sectionId, body) {
  const section = await repo.findSectionInCourse(courseId, sectionId);
  if (!section) throw new ApiError(404, 'Section not found');
  const data = {};
  if (body.title != null) data.title = body.title.trim();
  if (body.sort_order != null) data.sort_order = body.sort_order;
  const updated = await repo.updateSection(sectionId, data);
  return { section: updated };
}

async function deleteSection(courseId, sectionId) {
  const section = await repo.findSectionInCourse(courseId, sectionId);
  if (!section) throw new ApiError(404, 'Section not found');
  await repo.deleteSection(sectionId);
  return { deleted: true };
}

async function createLesson(courseId, sectionId, body) {
  const section = await repo.findSectionInCourse(courseId, sectionId);
  if (!section) throw new ApiError(404, 'Section not found');
  const course = await repo.findById(courseId);
  const sectionRow = (course.course_sections || []).find((s) => s.id === sectionId);
  const maxOrder = (sectionRow?.course_lessons || []).reduce((m, l) => Math.max(m, l.sort_order), -1);
  const lesson = await repo.createLesson(courseId, sectionId, {
    title: body.title.trim(),
    description: body.description ?? null,
    type: body.type,
    video_url: body.video_url ?? null,
    content: body.content ?? null,
    resource_url: body.resource_url ?? null,
    duration_minutes: body.duration_minutes ?? null,
    sort_order: body.sort_order ?? maxOrder + 1,
    is_preview: body.is_preview ?? false,
    is_required: body.is_required ?? true,
    status: body.status ?? 'draft',
  });
  return { lesson };
}

async function updateLesson(courseId, lessonId, body) {
  const lesson = await repo.findLessonInCourse(courseId, lessonId);
  if (!lesson) throw new ApiError(404, 'Lesson not found');
  const data = { ...body };
  if (data.title != null) data.title = data.title.trim();
  if (data.section_id != null && data.section_id !== lesson.section_id) {
    const section = await repo.findSectionInCourse(courseId, data.section_id);
    if (!section) throw new ApiError(400, 'Invalid section for this course');
  }
  delete data.section_id;
  const updated = await repo.updateLesson(lessonId, data);
  return { lesson: updated };
}

async function deleteLesson(courseId, lessonId) {
  const lesson = await repo.findLessonInCourse(courseId, lessonId);
  if (!lesson) throw new ApiError(404, 'Lesson not found');
  await repo.deleteLesson(lessonId);
  return { deleted: true };
}

async function reorderLessons(courseId, items) {
  const course = await repo.findById(courseId);
  if (!course) throw new ApiError(404, 'Course not found');
  await repo.reorderLessons(courseId, items);
  return getCourseStructure(courseId);
}

function mapStudentCourseCard(course, enrollment, progressPct) {
  const lessonsCount = (course.course_sections || []).reduce(
    (n, s) => n + (s.course_lessons?.length || 0),
    0
  );
  return {
    id: course.id,
    title: course.title,
    slug: course.slug,
    short_description: course.short_description,
    level: course.level,
    category: course.category,
    cover_image_url: course.cover_image_url,
    estimated_duration_minutes: course.estimated_duration_minutes,
    lessons_count: lessonsCount,
    progress_percent: progressPct,
    enrollment_status: enrollment?.status ?? null,
    started_at: enrollment?.started_at ?? null,
  };
}

async function computeProgressPercent(courseId, studentId) {
  const total = await repo.countPublishedLessons(courseId);
  if (!total) return 0;
  const progress = await repo.findProgressForCourse(courseId, studentId);
  const completed = progress.filter((p) => p.is_completed).length;
  return Math.round((completed / total) * 100);
}

async function listStudentCourses(query, studentId) {
  const where = {};
  if (query.level) where.level = query.level;
  if (query.category) {
    where.category = { equals: query.category, mode: 'insensitive' };
  }
  if (query.search) {
    const s = query.search.trim();
    if (s) {
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { short_description: { contains: s, mode: 'insensitive' } },
      ];
    }
  }
  const rows = await repo.findPublishedManyForStudent({ where }, studentId);
  const courses = await Promise.all(
    rows.map(async (c) => {
      const enrollment = await repo.findEnrollment(c.id, studentId);
      const progress_percent = enrollment
        ? await computeProgressPercent(c.id, studentId)
        : 0;
      return mapStudentCourseCard(c, enrollment, progress_percent);
    })
  );
  return { courses };
}

async function getStudentCourseById(courseId, studentId) {
  const course = await repo.findPublishedByIdForStudent(courseId, studentId);
  if (!course) throw new ApiError(404, 'Course not found');
  const enrollment = await repo.findEnrollment(courseId, studentId);
  const progress_percent = enrollment ? await computeProgressPercent(courseId, studentId) : 0;
  const progress = enrollment ? await repo.findProgressForCourse(courseId, studentId) : [];
  const completedSet = new Set(progress.filter((p) => p.is_completed).map((p) => p.lesson_id));
  const structure = mapStructure(course);
  structure.sections = structure.sections.map((s) => ({
    ...s,
    lessons: s.lessons.map((l) => ({
      ...l,
      is_completed: completedSet.has(l.id),
    })),
  }));
  return {
    course: {
      ...mapStudentCourseCard(course, enrollment, progress_percent),
      description: course.description,
    },
    ...structure,
    progress_percent,
  };
}

async function startStudentCourse(courseId, studentId) {
  const course = await repo.findPublishedByIdForStudent(courseId, studentId);
  if (!course) throw new ApiError(404, 'Course not found');
  const enrollment = await repo.upsertEnrollment(courseId, studentId);
  return { enrollment };
}

async function completeLesson(courseId, lessonId, studentId) {
  const course = await repo.findPublishedByIdForStudent(courseId, studentId);
  if (!course) throw new ApiError(404, 'Course not found');
  const lesson = await repo.findLessonInCourse(courseId, lessonId);
  if (!lesson || lesson.status !== 'published') {
    throw new ApiError(404, 'Lesson not found');
  }
  await repo.upsertEnrollment(courseId, studentId);
  const progress = await repo.upsertLessonComplete(courseId, lessonId, studentId);
  const progress_percent = await computeProgressPercent(courseId, studentId);
  const total = await repo.countPublishedLessons(courseId);
  const completedCount = (await repo.findProgressForCourse(courseId, studentId)).filter(
    (p) => p.is_completed
  ).length;
  if (total > 0 && completedCount >= total) {
    const en = await repo.findEnrollment(courseId, studentId);
    if (en && en.status !== 'completed') {
      await repo.markEnrollmentCompleted(en.id);
    }
  }
  return { progress, progress_percent };
}

async function getStudentProgress(courseId, studentId) {
  const course = await repo.findPublishedByIdForStudent(courseId, studentId);
  if (!course) throw new ApiError(404, 'Course not found');
  const enrollment = await repo.findEnrollment(courseId, studentId);
  const progress = await repo.findProgressForCourse(courseId, studentId);
  const progress_percent = enrollment ? await computeProgressPercent(courseId, studentId) : 0;
  return {
    enrollment,
    progress,
    progress_percent,
    completed_lesson_ids: progress.filter((p) => p.is_completed).map((p) => p.lesson_id),
  };
}

module.exports = {
  listAdminCourses,
  getAdminCourseById,
  createAdminCourse,
  updateAdminCourse,
  publishCourse,
  archiveCourse,
  getCourseStructure,
  createSection,
  updateSection,
  deleteSection,
  createLesson,
  updateLesson,
  deleteLesson,
  reorderLessons,
  listStudentCourses,
  getStudentCourseById,
  startStudentCourse,
  completeLesson,
  getStudentProgress,
};
