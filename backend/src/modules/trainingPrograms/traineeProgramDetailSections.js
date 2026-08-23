'use strict';

const TRAINEE_DETAIL_SECTION_KEYS = ['sessions', 'tasks', 'assessments', 'materials', 'certificate'];

/**
 * Parse `?sections=` for trainee course detail.
 * omitted / all → full payload (backward compatible)
 * overview → core enrollment/progress only (no tab datasets)
 */
function resolveTraineeDetailSections(raw) {
  if (raw == null || String(raw).trim() === '' || String(raw).trim().toLowerCase() === 'all') {
    return new Set(TRAINEE_DETAIL_SECTION_KEYS);
  }
  const tokens = String(raw)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const wanted = new Set();
  for (const token of tokens) {
    if (token === 'overview') continue;
    if (token === 'lectures') {
      wanted.add('materials');
      continue;
    }
    if (TRAINEE_DETAIL_SECTION_KEYS.includes(token)) {
      wanted.add(token);
    }
  }
  return wanted;
}

module.exports = { resolveTraineeDetailSections, TRAINEE_DETAIL_SECTION_KEYS };
