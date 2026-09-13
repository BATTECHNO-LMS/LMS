import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterStudentLectures,
  lectureCtaKey,
  mergeDetailProgress,
  mergeLectureProgress,
  summarizeStudentLectures,
} from '../src/features/fieldTraining/recordedLectureStudentUx.js';
import {
  formatClock,
  formatPercentValue,
  watchStatusKey,
} from '../src/features/fieldTraining/recordedLectureTime.js';

function lecture(id, overrides = {}) {
  return {
    id,
    title: `Lecture ${id}`,
    instructorName: overrides.instructorName ?? null,
    sortOrder: Number(id),
    durationSeconds: 3600,
    progress: {
      uniqueWatchedSeconds: 0,
      progressPercentage: 0,
      lastPositionSeconds: 0,
      completedAt: null,
      ...(overrides.progress || {}),
    },
    ...overrides,
  };
}

describe('recorded lecture student UX helpers', () => {
  it('maps CTA keys from backend watch state', () => {
    assert.equal(lectureCtaKey({ uniqueWatchedSeconds: 0 }), 'startWatching');
    assert.equal(
      lectureCtaKey({ uniqueWatchedSeconds: 120, resumePositionSeconds: 130, progressPercentage: 10 }),
      'continue'
    );
    assert.equal(
      lectureCtaKey({ uniqueWatchedSeconds: 3400, progressPercentage: 94, completedAt: '2026-09-12' }),
      'watchAgain'
    );
  });

  it('keeps completed progress at the backend percentage instead of forcing 100', () => {
    const progress = { uniqueWatchedSeconds: 3384, progressPercentage: 94, completedAt: '2026-09-12' };
    assert.equal(watchStatusKey(progress), 'completed');
    assert.equal(formatPercentValue(progress.progressPercentage), '94');
    assert.notEqual(formatPercentValue(progress.progressPercentage), '100');
  });

  it('filters and searches a twenty-lecture list without changing sort order', () => {
    const lectures = Array.from({ length: 20 }, (_, i) =>
      lecture(String(i + 1).padStart(2, '0'), {
        title: i === 3 ? 'React Components' : `Topic ${i + 1}`,
        instructorName: i === 3 ? 'Sara' : null,
        progress:
          i < 5
            ? { uniqueWatchedSeconds: 3300, progressPercentage: 92, completedAt: '2026-09-12' }
            : i < 9
              ? { uniqueWatchedSeconds: 400, progressPercentage: 11, resumePositionSeconds: 410 }
              : { uniqueWatchedSeconds: 0, progressPercentage: 0 },
      })
    );
    const summary = summarizeStudentLectures(lectures);
    assert.equal(summary.total, 20);
    assert.equal(summary.completed, 5);
    const completed = filterStudentLectures(lectures, { status: 'completed' });
    assert.equal(completed.length, 5);
    assert.deepEqual(
      completed.map((row) => row.sortOrder),
      [1, 2, 3, 4, 5]
    );
    const searched = filterStudentLectures(lectures, { query: 'react' });
    assert.equal(searched.length, 1);
    assert.equal(searched[0].title, 'React Components');
    const byInstructor = filterStudentLectures(lectures, { query: 'sara' });
    assert.equal(byInstructor.length, 1);
  });

  it('patches list and detail progress cache without dropping other lectures', () => {
    const list = {
      lectures: [lecture('a'), lecture('b', { progress: { uniqueWatchedSeconds: 10, progressPercentage: 2 } })],
      summary: { total: 2, completed: 0 },
    };
    const next = {
      uniqueWatchedSeconds: 1200,
      progressPercentage: 33.3,
      lastPositionSeconds: 1250,
      completedAt: null,
    };
    const patched = mergeLectureProgress(list, 'a', next);
    assert.equal(patched.lectures[0].progress.progressPercentage, 33.3);
    assert.equal(patched.lectures[1].progress.progressPercentage, 2);
    assert.equal(patched.summary.completed, 0);
    const detail = mergeDetailProgress({ lecture: lecture('a'), previous: null, next: null }, next);
    assert.equal(detail.lecture.progress.lastPositionSeconds, 1250);
  });

  it('formats clocks in LTR-safe hour:minute:second order', () => {
    assert.equal(formatClock(1450), '24:10');
    assert.equal(formatClock(5534), '1:32:14');
  });
});
