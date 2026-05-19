/**
 * Client-side checks aligned with backend publish readiness (metadata only).
 * Sections/lessons are validated on the server at publish time.
 */

export function validateCourseMetadataForPublish(form, t) {
  const errors = {};
  const missing = [];

  const title = String(form.title ?? '').trim();
  if (title.length < 3) {
    errors.title = t('composer.validation.titleMin');
    missing.push(t('composer.validation.titleMin'));
  }

  const desc = String(form.description ?? '').trim();
  if (desc.length < 10) {
    errors.description = t('composer.validation.descriptionMin');
    missing.push(t('composer.validation.descriptionMin'));
  }

  return { errors, missing };
}

export function buildCourseBody(form) {
  return {
    title: form.title.trim(),
    short_description: form.short_description.trim() || null,
    description: form.description.trim() || null,
    cover_image_url: form.cover_image_url.trim() || null,
    category: form.category.trim() || null,
    level: form.level,
    estimated_duration_minutes: form.estimated_duration_minutes
      ? Number(form.estimated_duration_minutes)
      : null,
    cohort_ids: form.all_students
      ? []
      : Array.isArray(form.cohort_ids)
        ? form.cohort_ids
        : [],
  };
}

export const EMPTY_COURSE_FORM = {
  title: '',
  short_description: '',
  description: '',
  cover_image_url: '',
  category: '',
  level: 'beginner',
  estimated_duration_minutes: '',
  cohort_ids: [],
  all_students: true,
};

export function courseRowToForm(row) {
  if (!row) return { ...EMPTY_COURSE_FORM };
  return {
    title: row.title ?? '',
    short_description: row.short_description ?? '',
    description: row.description ?? '',
    cover_image_url: row.cover_image_url ?? '',
    category: row.category ?? '',
    level: row.level ?? 'beginner',
    estimated_duration_minutes:
      row.estimated_duration_minutes != null ? String(row.estimated_duration_minutes) : '',
    cohort_ids: Array.isArray(row.cohort_ids)
      ? row.cohort_ids
      : Array.isArray(row.cohorts)
        ? row.cohorts.map((c) => c.id)
        : [],
    all_students:
      !(Array.isArray(row.cohort_ids) && row.cohort_ids.length) &&
      !(Array.isArray(row.cohorts) && row.cohorts.length),
  };
}
