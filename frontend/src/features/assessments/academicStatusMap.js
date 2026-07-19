/**
 * Academic (cohort) status labels — separate from field-training maps.
 * Never invent transitions; unknown codes fall back safely.
 */

const SUBMISSION_STATUS_LABELS = {
  en: {
    draft: 'Draft',
    submitted: 'Submitted',
    late: 'Late',
    resubmitted: 'Resubmitted',
    graded: 'Graded',
    returned: 'Returned',
  },
  ar: {
    draft: 'مسودة',
    submitted: 'مُسلَّم',
    late: 'متأخر',
    resubmitted: 'أُعيد تسليمه',
    graded: 'مُقيَّم',
    returned: 'مُعاد',
  },
};

const ASSESSMENT_STATUS_LABELS = {
  en: {
    draft: 'Draft',
    published: 'Published',
    open: 'Open',
    closed: 'Closed',
    archived: 'Archived',
  },
  ar: {
    draft: 'مسودة',
    published: 'منشور',
    open: 'مفتوح',
    closed: 'مغلق',
    archived: 'مؤرشف',
  },
};

/**
 * @param {string | null | undefined} status
 * @param {'en'|'ar'} [locale]
 */
export function academicSubmissionStatusLabel(status, locale = 'en') {
  const code = String(status || '').toLowerCase();
  const table = SUBMISSION_STATUS_LABELS[locale] || SUBMISSION_STATUS_LABELS.en;
  if (table[code]) return table[code];
  if (!code) return locale === 'ar' ? 'غير معروف' : 'Unknown';
  return locale === 'ar' ? `حالة غير معروفة (${code})` : `Unknown status (${code})`;
}

/**
 * @param {string | null | undefined} status
 * @param {'en'|'ar'} [locale]
 */
export function academicAssessmentStatusLabel(status, locale = 'en') {
  const code = String(status || '').toLowerCase();
  const table = ASSESSMENT_STATUS_LABELS[locale] || ASSESSMENT_STATUS_LABELS.en;
  if (table[code]) return table[code];
  if (!code) return locale === 'ar' ? 'غير معروف' : 'Unknown';
  return locale === 'ar' ? `حالة غير معروفة (${code})` : `Unknown status (${code})`;
}

/** Backend statuses that allow student PUT when no final grade exists. */
export const EDITABLE_SUBMISSION_STATUSES = new Set([
  'draft',
  'submitted',
  'late',
  'resubmitted',
]);

/**
 * @param {{ status?: string, current_grade?: { is_final?: boolean } | null } | null | undefined} submission
 */
export function isAcademicSubmissionEditable(submission) {
  if (!submission) return false;
  if (submission.current_grade?.is_final) return false;
  if (submission.status === 'graded') return false;
  return EDITABLE_SUBMISSION_STATUSES.has(String(submission.status || '').toLowerCase());
}
