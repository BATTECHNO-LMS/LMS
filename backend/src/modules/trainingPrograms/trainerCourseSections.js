'use strict';

const TRAINER_COURSE_SECTION_KEYS = ['sessions', 'tasks', 'assessments', 'trainees'];

/**
 * Parse `?sections=` for trainer course detail.
 * omitted / all → full payload (backward compatible)
 * overview → program/permissions/counts only
 */
function resolveTrainerCourseSections(raw) {
  if (raw == null || String(raw).trim() === '' || String(raw).trim().toLowerCase() === 'all') {
    return new Set(TRAINER_COURSE_SECTION_KEYS);
  }
  const tokens = String(raw)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const wanted = new Set();
  for (const token of tokens) {
    if (token === 'overview') continue;
    if (token === 'attendance') {
      wanted.add('sessions');
      continue;
    }
    if (token === 'progress' || token === 'certificates') {
      wanted.add('trainees');
      continue;
    }
    if (TRAINER_COURSE_SECTION_KEYS.includes(token)) {
      wanted.add(token);
    }
  }
  return wanted;
}

module.exports = { resolveTrainerCourseSections, TRAINER_COURSE_SECTION_KEYS };
