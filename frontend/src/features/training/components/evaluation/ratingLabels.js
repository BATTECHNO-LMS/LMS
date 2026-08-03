/**
 * Pure presentation helpers for the 1-5 Likert final-evaluation questions.
 * Mirrors backend/src/modules/trainingPrograms/trainingEvaluation.scoring.js
 * RATING_LABELS_AR so trainee-facing labels match the scoring semantics.
 */

export const RATING_LABELS_AR = Object.freeze({
  1: 'لا أوافق بشدة',
  2: 'لا أوافق',
  3: 'محايد',
  4: 'أوافق',
  5: 'أوافق بشدة',
});

/**
 * @param {number|string} value
 * @param {Record<string|number, string>|null|undefined} customLabels
 * @returns {string}
 */
export function resolveRatingLabel(value, customLabels) {
  if (value == null || value === '') return '';
  const labels = customLabels && typeof customLabels === 'object' ? customLabels : RATING_LABELS_AR;
  return labels[value] ?? labels[String(value)] ?? RATING_LABELS_AR[value] ?? RATING_LABELS_AR[String(value)] ?? '';
}

/**
 * @param {number} min
 * @param {number} max
 * @returns {number[]}
 */
export function ratingScaleOptions(min = 1, max = 5) {
  const lo = Number.isFinite(Number(min)) ? Number(min) : 1;
  const hi = Number.isFinite(Number(max)) ? Number(max) : 5;
  const options = [];
  for (let i = lo; i <= hi; i += 1) options.push(i);
  return options;
}

/** Classic 0-10 NPS bucketing, mirrors backend npsCategory(). */
export function npsCategory(score) {
  if (score == null || score === '') return null;
  const n = Number(score);
  if (!Number.isFinite(n)) return null;
  if (n >= 9) return 'PROMOTER';
  if (n >= 7) return 'PASSIVE';
  return 'DETRACTOR';
}
