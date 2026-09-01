'use strict';

const {
  MISSING_FIELD_CODES,
  MISSING_FIELD_LABELS_AR,
  PAYLOAD_KEY_TO_MISSING_CODE,
} = require('./fieldTrainingEvaluation.constants');

function missingCodeOf(payloadKey) {
  return PAYLOAD_KEY_TO_MISSING_CODE[payloadKey] || String(payloadKey || '').toUpperCase();
}

function missingLabelAr(code) {
  return MISSING_FIELD_LABELS_AR[code] || String(code || '').replace(/_/g, ' ');
}

function toMissingFieldEntries(keys = []) {
  const seen = new Set();
  const out = [];
  for (const key of keys) {
    const code = Object.values(MISSING_FIELD_CODES).includes(key) ? key : missingCodeOf(key);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push({
      key: PAYLOAD_KEY_TO_MISSING_CODE[key] ? key : null,
      code,
      labelAr: missingLabelAr(code),
    });
  }
  return out;
}

module.exports = {
  missingCodeOf,
  missingLabelAr,
  toMissingFieldEntries,
};
