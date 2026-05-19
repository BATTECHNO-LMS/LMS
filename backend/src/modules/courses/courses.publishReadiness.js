const { ApiError } = require('../../utils/apiError');

const MSG = {
  title: 'العنوان مطلوب (3 أحرف على الأقل)',
  description: 'الوصف الكامل مطلوب (10 أحرف على الأقل)',
  section: 'يجب إضافة قسم واحد على الأقل',
  lesson: 'يجب إضافة درس واحد على الأقل',
  lesson_title: 'كل درس يحتاج عنوانًا واضحًا',
  lesson_video: 'درس الفيديو يحتاج رابط فيديو',
  lesson_text: 'درس النص يحتاج محتوى نصي',
  archived: 'لا يمكن نشر كورس مؤرشف',
};

/**
 * @param {{ status: string, title: string, description: string | null, course_sections: Array<{ course_lessons: Array<{ title: string, type: string, video_url: string | null, content: string | null }> }> }} course
 */
function collectPublishMissing(course) {
  const missing = [];

  if (course.status === 'archived') {
    missing.push(MSG.archived);
    return missing;
  }

  const title = String(course.title || '').trim();
  if (title.length < 3) missing.push(MSG.title);

  const desc = String(course.description || '').trim();
  if (desc.length < 10) missing.push(MSG.description);

  const sections = course.course_sections || [];
  if (!sections.length) missing.push(MSG.section);

  const lessons = sections.flatMap((s) => s.course_lessons || []);
  if (!lessons.length) missing.push(MSG.lesson);

  for (const lesson of lessons) {
    const lt = String(lesson.title || '').trim();
    if (!lt) {
      missing.push(MSG.lesson_title);
      break;
    }
    if (lesson.type === 'video') {
      if (!String(lesson.video_url || '').trim()) missing.push(MSG.lesson_video);
    }
    if (lesson.type === 'text') {
      if (!String(lesson.content || '').trim()) missing.push(MSG.lesson_text);
    }
  }

  return [...new Set(missing)];
}

/**
 * @param {Parameters<typeof collectPublishMissing>[0]} course
 */
function assertPublishReady(course) {
  const missing = collectPublishMissing(course);
  if (missing.length) {
    throw new ApiError(400, 'الكورس غير جاهز للنشر', { missing }, 'COURSE_PUBLISH_READINESS');
  }
}

module.exports = { collectPublishMissing, assertPublishReady, MSG };
