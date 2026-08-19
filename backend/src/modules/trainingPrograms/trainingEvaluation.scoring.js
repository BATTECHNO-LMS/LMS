'use strict';

/**
 * Pure, DB-free scoring helpers for the institutional final training evaluation.
 * Kept separate from trainingEvaluation.service.js so the scoring rules can be
 * unit-tested without touching Prisma.
 */

const RATING_LABELS_AR = Object.freeze({
  1: 'لا أوافق بشدة',
  2: 'لا أوافق',
  3: 'محايد',
  4: 'أوافق',
  5: 'أوافق بشدة',
});

/**
 * Classic 0-10 NPS bucketing: 9-10 promoters, 7-8 passives, 0-6 detractors.
 * @param {number} score
 * @returns {'PROMOTER'|'PASSIVE'|'DETRACTOR'|null}
 */
function npsCategory(score) {
  if (score == null || score === '') return null;
  const n = Number(score);
  if (!Number.isFinite(n)) return null;
  if (n >= 9) return 'PROMOTER';
  if (n >= 7) return 'PASSIVE';
  return 'DETRACTOR';
}

/**
 * @param {Array<number|null|undefined>} nums
 * @returns {number|null} rounded to 2 decimals, or null when there is no numeric input
 */
function average(nums) {
  const list = (nums || []).filter((n) => typeof n === 'number' && Number.isFinite(n));
  if (!list.length) return null;
  const sum = list.reduce((acc, n) => acc + n, 0);
  return Math.round((sum / list.length) * 100) / 100;
}

/**
 * A question only applies to certain delivery modes when delivery_modes_json lists them.
 * Null/empty means the question applies to every delivery mode.
 * @param {Array<{ delivery_modes_json?: unknown }>} questions
 * @param {string|null|undefined} deliveryMode
 */
function filterQuestionsForDeliveryMode(questions, deliveryMode) {
  const mode = deliveryMode ? String(deliveryMode).toUpperCase() : null;
  return (questions || []).filter((q) => {
    const raw = q.delivery_modes_json;
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.modes) ? raw.modes : null;
    if (!list || !list.length) return true;
    if (!mode) return true;
    return list.map((m) => String(m).toUpperCase()).includes(mode);
  });
}

/**
 * Extract the numeric/text value an answer carries, regardless of whether it was
 * stored as a raw scalar (legacy) or as `{ value }` / `{ text }` (current format).
 */
function extractAnswerValue(answer, isOpenText) {
  if (answer == null) return null;
  if (isOpenText) {
    if (typeof answer === 'object') return answer.text ?? null;
    return answer;
  }
  if (typeof answer === 'object') {
    const v = answer.value ?? answer.numeric_value;
    return v == null ? null : Number(v);
  }
  const n = Number(answer);
  return Number.isFinite(n) ? n : null;
}

/**
 * Flattened question shape expected here: { id, code, question_type, section_code }.
 * The service layer maps Prisma rows (section -> questions) into this flat shape.
 *
 * @param {Array<{id:string, code?:string, question_type:string, section_code:string}>} questions
 * @param {Record<string, unknown>} answersByQuestionId
 */
function computeSectionScores(questions, answersByQuestionId) {
  const list = Array.isArray(questions) ? questions : [];
  const answers = answersByQuestionId && typeof answersByQuestionId === 'object' ? answersByQuestionId : {};

  function ratingValuesFor(sectionCode, codePrefix) {
    return list
      .filter((q) => q.section_code === sectionCode)
      .filter((q) => !codePrefix || String(q.code || '').toUpperCase().startsWith(codePrefix))
      .filter((q) => q.question_type === 'RATING_SCALE')
      .map((q) => extractAnswerValue(answers[q.id], false))
      .filter((v) => v != null);
  }

  const trainer_score = average(ratingValuesFor('TRAINER'));
  const content_score = average(ratingValuesFor('CONTENT'));
  const activities_score = average(ratingValuesFor('ACTIVITIES'));
  const venue_score = average(ratingValuesFor('VENUE_ORG', 'V_IP'));
  const technical_environment_score = average(ratingValuesFor('VENUE_ORG', 'V_ON'));
  // Overall organization/environment indicator across the delivery-mode-filtered venue questions.
  const organization_score =
    average(ratingValuesFor('VENUE_ORG', 'V_HY')) ??
    average(ratingValuesFor('VENUE_ORG')) ??
    technical_environment_score ??
    venue_score;
  const immediate_impact_score = average(ratingValuesFor('IMPACT'));

  const overall_reaction_score = average([
    trainer_score,
    content_score,
    activities_score,
    venue_score,
    technical_environment_score,
    organization_score,
    immediate_impact_score,
  ]);

  const npsQuestion = list.find(
    (q) => q.question_type === 'NPS' || q.section_code === 'NPS_FEEDBACK'
  );
  let nps_score = null;
  let nps_category = null;
  if (npsQuestion) {
    nps_score = extractAnswerValue(answers[npsQuestion.id], false);
    nps_category = nps_score == null ? null : npsCategory(nps_score);
  }

  return {
    trainer_score,
    content_score,
    activities_score,
    venue_score,
    technical_environment_score,
    organization_score,
    immediate_impact_score,
    overall_reaction_score,
    nps_score,
    nps_category,
  };
}

/**
 * Count/percentage distribution for a 1–5 (or custom) rating question.
 * @param {Array<number>} values
 * @param {number} [min=1]
 * @param {number} [max=5]
 */
function buildRatingDistribution(values, min = 1, max = 5) {
  const counts = {};
  for (let i = min; i <= max; i += 1) counts[i] = 0;
  const nums = (values || []).map((v) => Number(v)).filter((n) => Number.isInteger(n) && n >= min && n <= max);
  for (const n of nums) counts[n] += 1;
  const total = nums.length;
  const percentages = {};
  for (let i = min; i <= max; i += 1) {
    percentages[i] = total ? Math.round((counts[i] / total) * 10000) / 100 : 0;
  }
  return { counts, percentages, n: total, average: average(nums) };
}

/**
 * Kirkpatrick mapping used by this engine.
 * FINAL_EVALUATION is Level 1 only. Pre/post tests are Level 2.
 * Level 3/4 follow-up kinds are reserved and must not be inferred from this survey.
 */
const KIRKPATRICK = Object.freeze({
  FINAL_EVALUATION: 'LEVEL_1_REACTION',
  PRE_POST_TESTS: 'LEVEL_2_LEARNING',
  FOLLOW_UP_BEHAVIOR: 'LEVEL_3_RESERVED',
  FOLLOW_UP_RESULTS: 'LEVEL_4_RESERVED',
});

module.exports = {
  RATING_LABELS_AR,
  KIRKPATRICK,
  npsCategory,
  average,
  filterQuestionsForDeliveryMode,
  extractAnswerValue,
  computeSectionScores,
  buildRatingDistribution,
};
