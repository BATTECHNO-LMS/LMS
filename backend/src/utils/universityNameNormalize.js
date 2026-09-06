'use strict';

/**
 * Normalize university display labels for Excel imports / alias matching.
 * Canonical keys are stable strings (not DB ids) so aliases can resolve
 * to one university without string-equality on the Arabic display name alone.
 */

function normalizeUniversityLabel(value) {
  return String(value || '')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\u0640/g, '')
    .replace(/\u200f|\u200e/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Normalized label → canonical university key.
 * Only list aliases that intentionally refer to the same institution.
 */
const UNIVERSITY_LABEL_CANONICAL_KEYS = Object.freeze({
  'جامعة الزرقاء الخاصة': 'zarqa-private-university',
  'جامعة الزرقاء': 'zarqa-private-university',
  'zarqa private university': 'zarqa-private-university',
  'zarqa university': 'zarqa-private-university',
});

function universityLabelCanonicalKey(value) {
  const normalized = normalizeUniversityLabel(value);
  if (!normalized) return '';
  return UNIVERSITY_LABEL_CANONICAL_KEYS[normalized] || normalized;
}

function universityLabelsMatch(a, b) {
  const left = universityLabelCanonicalKey(a);
  const right = universityLabelCanonicalKey(b);
  return Boolean(left && right && left === right);
}

/** Alias strings that may appear in Excel / legacy rows for a given canonical key. */
function aliasesForCanonicalKey(canonicalKey) {
  const key = String(canonicalKey || '').trim().toLowerCase();
  if (!key) return [];
  return Object.entries(UNIVERSITY_LABEL_CANONICAL_KEYS)
    .filter(([, mapped]) => mapped === key)
    .map(([label]) => label);
}

module.exports = {
  normalizeUniversityLabel,
  universityLabelCanonicalKey,
  universityLabelsMatch,
  aliasesForCanonicalKey,
  UNIVERSITY_LABEL_CANONICAL_KEYS,
};
