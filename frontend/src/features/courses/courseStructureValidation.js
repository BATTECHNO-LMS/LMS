/**
 * Client-side validation for course structure forms (no browser default messages).
 * @param {(key: string) => string} t - i18n translate function for structure.validation.*
 */

export function emptyLessonForm() {
  return {
    title: '',
    description: '',
    type: 'video',
    video_url: '',
    content: '',
    resource_url: '',
    duration_minutes: '',
    status: 'draft',
    is_preview: false,
    is_required: true,
  };
}

export function lessonToForm(lesson) {
  if (!lesson) return emptyLessonForm();
  return {
    title: lesson.title ?? '',
    description: lesson.description ?? '',
    type: lesson.type ?? 'video',
    video_url: lesson.video_url ?? '',
    content: lesson.content ?? '',
    resource_url: lesson.resource_url ?? '',
    duration_minutes: lesson.duration_minutes != null ? String(lesson.duration_minutes) : '',
    status: lesson.status ?? 'draft',
    is_preview: Boolean(lesson.is_preview),
    is_required: lesson.is_required !== false,
  };
}

export function validateSectionForm(values, t) {
  const errors = {};
  const title = String(values.title ?? '').trim();
  if (!title) errors.title = t('structure.validation.sectionTitleRequired');
  else if (title.length < 2) errors.title = t('structure.validation.sectionTitleMin');
  return errors;
}

export function validateLessonForm(values, t) {
  const errors = {};
  const title = String(values.title ?? '').trim();
  if (!title) errors.title = t('structure.validation.lessonTitleRequired');

  const type = values.type;
  if (type === 'video' && !String(values.video_url ?? '').trim()) {
    errors.video_url = t('structure.validation.videoUrlRequired');
  }
  if (type === 'text' && !String(values.content ?? '').trim()) {
    errors.content = t('structure.validation.contentRequired');
  }
  if ((type === 'link' || type === 'file') && !String(values.resource_url ?? '').trim()) {
    errors.resource_url = t('structure.validation.resourceUrlRequired');
  }

  const dur = String(values.duration_minutes ?? '').trim();
  if (dur && (Number.isNaN(Number(dur)) || Number(dur) < 0)) {
    errors.duration_minutes = t('structure.validation.durationInvalid');
  }

  return errors;
}

export function lessonFormToBody(form) {
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    type: form.type,
    video_url: form.type === 'video' ? form.video_url.trim() || null : null,
    content: form.type === 'text' ? form.content.trim() || null : null,
    resource_url: form.type === 'link' || form.type === 'file' ? form.resource_url.trim() || null : null,
    duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
    status: form.status,
    is_preview: Boolean(form.is_preview),
    is_required: Boolean(form.is_required),
  };
}

export function computeStructureStats(sections = []) {
  const lessons = sections.flatMap((s) => s.lessons ?? []);
  return {
    sectionsCount: sections.length,
    lessonsCount: lessons.length,
    publishedLessons: lessons.filter((l) => l.status === 'published').length,
    draftLessons: lessons.filter((l) => l.status === 'draft').length,
  };
}
