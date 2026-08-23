'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { dateOnlyISO, formatDateOnly, parseDateOnly, toDateOnly } = require('../src/utils/dateOnly');

describe('dateOnly helpers', () => {
  it('returns YYYY-MM-DD strings unchanged', () => {
    assert.equal(formatDateOnly('2026-08-23'), '2026-08-23');
    assert.equal(dateOnlyISO('2026-08-23'), '2026-08-23');
  });

  it('formats UTC midnight dates without shifting the calendar day', () => {
    assert.equal(formatDateOnly(new Date('2026-08-23T00:00:00.000Z')), '2026-08-23');
  });

  it('returns null for empty values', () => {
    assert.equal(formatDateOnly(null), null);
    assert.equal(toDateOnly(''), null);
    assert.equal(toDateOnly(null), null);
  });

  it('parses YYYY-MM-DD as UTC midnight', () => {
    const d = parseDateOnly('2026-01-15');
    assert.equal(d.toISOString(), '2026-01-15T00:00:00.000Z');
  });
});
