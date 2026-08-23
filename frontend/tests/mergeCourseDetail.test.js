import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeTraineeProgramDetail,
  mergeTrainerCourseDetail,
} from '../src/features/training/mergeCourseDetail.js';

describe('mergeTraineeProgramDetail', () => {
  it('keeps previously loaded tab arrays when overview omits them', () => {
    const prev = { enrollmentId: 'e1', sessions: [{ id: 's1' }], tasks: [{ id: 't1' }] };
    const next = { enrollmentId: 'e1', progress: { completionPct: 40 } };
    const merged = mergeTraineeProgramDetail(prev, next);
    assert.deepEqual(merged.sessions, [{ id: 's1' }]);
    assert.deepEqual(merged.tasks, [{ id: 't1' }]);
    assert.equal(merged.progress.completionPct, 40);
  });
});

describe('mergeTrainerCourseDetail', () => {
  it('merges overview counts without wiping sessions', () => {
    const prev = { sessions: [{ id: 's1' }], overview: { pendingSubmissions: 2 } };
    const next = { overview: { pendingSubmissions: 3, unconfirmedAttendance: 1 }, traineeCount: 9 };
    const merged = mergeTrainerCourseDetail(prev, next);
    assert.deepEqual(merged.sessions, [{ id: 's1' }]);
    assert.equal(merged.overview.pendingSubmissions, 3);
    assert.equal(merged.overview.unconfirmedAttendance, 1);
    assert.equal(merged.traineeCount, 9);
  });
});
