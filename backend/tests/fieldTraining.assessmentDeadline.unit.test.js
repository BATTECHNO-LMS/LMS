'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const deadline = require('../src/modules/fieldTraining/fieldTraining.assessmentDeadline');

const CLOSES = new Date('2026-09-13T23:59:00+03:00');

function published(overrides = {}) {
  return { status: 'published', type: 'pre', closes_at: CLOSES, ...overrides };
}

describe('field training assessment deadline', () => {
  it('treats timezone-naive admin values as Asia/Amman', () => {
    const parsed = deadline.parseClosesAt('2026-09-13T23:59');
    assert.equal(parsed.toISOString(), CLOSES.toISOString());
  });

  it('allows start one second before the deadline', () => {
    const now = new Date(CLOSES.getTime() - 1000);
    assert.equal(deadline.isAssessmentClosed(published(), { now }), false);
    assert.equal(deadline.isAssessmentOpen(published(), { now }), true);
    assert.doesNotThrow(() => deadline.assertNotClosed(published(), { now }));
  });

  it('blocks at the exact deadline and afterward', () => {
    assert.equal(deadline.isAssessmentClosed(published(), { now: CLOSES }), true);
    assert.equal(deadline.isAssessmentOpen(published(), { now: CLOSES }), false);
    assert.throws(
      () => deadline.assertNotClosed(published(), { now: CLOSES }),
      (err) => err.code === 'ASSESSMENT_CLOSED' && err.message.includes('انتهى موعد تقديم')
    );
    const after = new Date(CLOSES.getTime() + 1000);
    assert.equal(deadline.isAssessmentClosed(published(), { now: after }), true);
    assert.throws(() => deadline.assertStudentWindow(published(), { now: after }));
  });

  it('keeps legacy assessments open when closes_at is null', () => {
    const row = { status: 'published', closes_at: null };
    const now = new Date('2026-12-01T00:00:00+03:00');
    assert.equal(deadline.isAssessmentClosed(row, { now }), false);
    assert.equal(deadline.isAssessmentOpen(row, { now }), true);
    assert.equal(deadline.deriveDisplayStatus(row, { now }), 'published');
  });

  it('derives closed from published + now >= closesAt without a cron', () => {
    assert.equal(deadline.deriveDisplayStatus(published(), { now: CLOSES }), 'closed');
    assert.equal(
      deadline.deriveDisplayStatus(published(), { now: new Date(CLOSES.getTime() - 1000) }),
      'published'
    );
    assert.equal(deadline.deriveDisplayStatus({ status: 'draft', closes_at: CLOSES }, { now: CLOSES }), 'draft');
  });

  it('requires a future deadline only when initially publishing', () => {
    assert.throws(
      () => deadline.assertPublishDeadline(null, { isInitialPublish: true }),
      (err) => err.message === deadline.MSG_REQUIRED
    );
    assert.throws(
      () => deadline.assertPublishDeadline(CLOSES, { now: CLOSES, isInitialPublish: true }),
      (err) => err.message === deadline.MSG_FUTURE
    );
    assert.doesNotThrow(() =>
      deadline.assertPublishDeadline(CLOSES, {
        now: new Date(CLOSES.getTime() - 1000),
        isInitialPublish: true,
      })
    );
    assert.doesNotThrow(() =>
      deadline.assertPublishDeadline(CLOSES, { now: new Date(CLOSES.getTime() + 60_000), isInitialPublish: false })
    );
  });

  it('ignores a client-supplied now and uses the injected server clock', () => {
    const assessment = published();
    const serverNow = new Date(CLOSES.getTime() + 5000);
    const fakeBrowserNow = new Date(CLOSES.getTime() - 60_000);
    assert.equal(deadline.isAssessmentClosed(assessment, { now: serverNow }), true);
    assert.equal(deadline.isAssessmentClosed(assessment, { now: fakeBrowserNow }), false);
    assert.equal(deadline.serverNow(serverNow).getTime(), serverNow.getTime());
  });

  it('falls back to settings.closes_at when the column is empty', () => {
    const row = { status: 'published', closes_at: null };
    const settings = { closes_at: '2026-09-13T23:59:00+03:00' };
    assert.equal(deadline.isAssessmentClosed(row, { now: CLOSES, settings }), true);
  });

  it('exposes safe availability fields without answer keys', () => {
    const described = deadline.describeAvailability(published(), { now: new Date(CLOSES.getTime() - 1000) });
    assert.equal(described.timezone, 'Asia/Amman');
    assert.equal(described.isOpen, true);
    assert.equal(described.isClosed, false);
    assert.equal(described.closesAt, CLOSES.toISOString());
    assert.equal(JSON.stringify(described).includes('correct'), false);
  });
});
