'use strict';

const {
  CHECKMARK,
  CRITERION_SCORE_KEYS,
  PLACEHOLDERS,
  REQUIRED_PLACEHOLDER_GROUPS,
} = require('./fieldTrainingEvaluation.constants');

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function blank(value) {
  if (value == null) return '';
  const text = String(value);
  if (text === 'undefined' || text === 'null') return '';
  return text;
}

function extractPlaceholderNames(xmlOrText) {
  const found = new Set();
  const source = String(xmlOrText || '');
  let match;
  const re = new RegExp(PLACEHOLDER_RE.source, 'g');
  while ((match = re.exec(source))) {
    found.add(match[1]);
  }
  return found;
}

function repairSplitPlaceholders(xml) {
  return String(xml || '').replace(/\{\{([\s\S]*?)\}\}/g, (_full, inner) => {
    const name = String(inner)
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, '');
    return `{{${name}}}`;
  });
}

function gridCheckmarks(criteriaScores = {}) {
  const values = {};
  for (let criterion = 1; criterion <= 10; criterion += 1) {
    const score = criteriaScores[`criterion${criterion}`] ?? criteriaScores[`criterion_${criterion}_score`];
    const n = score == null || score === '' ? null : Number(score);
    for (let col = 1; col <= 5; col += 1) {
      values[`c${criterion}_${col}`] = n === col ? CHECKMARK : '';
    }
  }
  return values;
}

function validatePlaceholderSet(foundNames) {
  const found = foundNames instanceof Set ? foundNames : new Set(foundNames || []);
  const groups = REQUIRED_PLACEHOLDER_GROUPS.map((group) => {
    const missing = group.keys.filter((key) => !found.has(key));
    return {
      id: group.id,
      label: group.label,
      found: missing.length === 0,
      missing,
    };
  });
  const valid = groups.every((group) => group.found);
  return { valid, groups, found: [...found].sort() };
}

function buildPlaceholderMap(fields = {}) {
  const map = {};
  for (const key of Object.values(PLACEHOLDERS)) {
    map[key] = blank(fields[key]);
  }
  for (const key of CRITERION_SCORE_KEYS) {
    map[key] = blank(fields[key]);
  }
  Object.assign(map, gridCheckmarks(fields.criteria || fields));
  if (fields.extra && typeof fields.extra === 'object') {
    for (const [key, value] of Object.entries(fields.extra)) {
      map[key] = blank(value);
    }
  }
  return map;
}

function applyPlaceholdersToXml(xml, values) {
  const repaired = repairSplitPlaceholders(xml);
  return repaired.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_full, name) => {
    if (!Object.prototype.hasOwnProperty.call(values, name)) return '';
    return escapeXml(blank(values[name]));
  });
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = {
  blank,
  extractPlaceholderNames,
  repairSplitPlaceholders,
  gridCheckmarks,
  validatePlaceholderSet,
  buildPlaceholderMap,
  applyPlaceholdersToXml,
  escapeXml,
};
