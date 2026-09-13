import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { createWatchTracker } from '../src/features/fieldTraining/recordedLectureWatchTracker.js';
import { formatClock, watchStatusKey } from '../src/features/fieldTraining/recordedLectureTime.js';

const root = path.dirname(fileURLToPath(import.meta.url));

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

describe('recorded lecture watch tracker', () => {
  it('counts playback, ignores seek jumps, pause, buffering, and scrubbing', () => {
    const sent = [];
    const tracker = createWatchTracker({
      intervalSeconds: 10,
      seekJumpSeconds: 6,
      watchSessionId: '11111111-1111-4111-8111-111111111111',
      onFlush: (payload) => sent.push(payload),
    });

    tracker.handleTick(0, 'PLAYING');
    tracker.handleTick(5, 'PLAYING');
    tracker.handleTick(10, 'PLAYING');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].fromSecond, 0);
    assert.equal(sent[0].toSecond, 10);
    assert.equal(sent[0].playerState, 'PLAYING');

    tracker.handleTick(11, 'PLAYING');
    const seek = tracker.handleTick(600, 'PLAYING');
    assert.ok(seek);
    assert.notEqual(seek.fromSecond, 11);
    assert.notEqual(seek.toSecond, 600);
    tracker.handleTick(610, 'PLAYING');
    tracker.flush('PAUSED', 610);
    const uniqueLike = sent
      .filter((row) => row.playerState === 'PLAYING' && row.toSecond > row.fromSecond)
      .reduce((sum, row) => sum + (row.toSecond - row.fromSecond), 0);
    assert.ok(uniqueLike < 50);

    const paused = [];
    const pauseTracker = createWatchTracker({
      intervalSeconds: 10,
      seekJumpSeconds: 6,
      watchSessionId: '11111111-1111-4111-8111-111111111112',
      onFlush: (payload) => paused.push(payload),
    });
    pauseTracker.handleTick(0, 'PLAYING');
    pauseTracker.handleTick(4, 'PLAYING');
    pauseTracker.handleTick(8, 'PLAYING');
    pauseTracker.flush('PAUSED', 8);
    assert.equal(paused.some((row) => row.fromSecond === 0 && row.toSecond === 8), true);
    pauseTracker.handleTick(8, 'PAUSED');
    pauseTracker.handleTick(8, 'PAUSED');
    assert.equal(
      paused.filter((row) => row.playerState === 'PLAYING' && row.toSecond > row.fromSecond).length,
      1
    );

    const buffering = [];
    const buf = createWatchTracker({
      watchSessionId: '11111111-1111-4111-8111-111111111113',
      onFlush: (payload) => buffering.push(payload),
    });
    buf.handleTick(20, 'BUFFERING');
    buf.flush('BUFFERING', 20);
    assert.equal(
      buffering.some((row) => row.playerState === 'PLAYING' && row.toSecond > row.fromSecond),
      false
    );

    const scrub = [];
    const scrubber = createWatchTracker({
      watchSessionId: '11111111-1111-4111-8111-111111111114',
      onFlush: (payload) => scrub.push(payload),
    });
    scrubber.handleTick(0, 'PLAYING');
    scrubber.handleTick(400, 'PLAYING');
    scrubber.handleTick(900, 'PLAYING');
    const scrubSpans = scrub.filter((row) => row.toSecond - row.fromSecond > 20);
    assert.equal(scrubSpans.length, 0);
  });

  it('does not treat seek-to-end as a watched span', () => {
    const sent = [];
    const tracker = createWatchTracker({
      intervalSeconds: 10,
      seekJumpSeconds: 6,
      watchSessionId: '11111111-1111-4111-8111-111111111115',
      onFlush: (payload) => sent.push(payload),
    });
    tracker.handleTick(0, 'PLAYING');
    tracker.handleTick(10, 'PLAYING');
    tracker.handleTick(20, 'PLAYING');
    tracker.handleTick(30, 'PLAYING');
    tracker.handleTick(3590, 'PLAYING');
    tracker.handleTick(3600, 'PLAYING');
    tracker.flush('ENDED', 3600);
    const uniqueLike = sent
      .filter((row) => row.playerState === 'PLAYING' && row.toSecond > row.fromSecond)
      .reduce((sum, row) => sum + (row.toSecond - row.fromSecond), 0);
    assert.ok(uniqueLike <= 40);
    assert.equal(
      sent.some((row) => row.playerState === 'PLAYING' && row.fromSecond === 30 && row.toSecond >= 3590),
      false
    );
  });
});

describe('recorded lecture student time display', () => {
  it('formats clocks without raw seconds and maps watch states', () => {
    assert.equal(formatClock(5534), '1:32:14');
    assert.equal(formatClock(90), '1:30');
    assert.equal(watchStatusKey({ uniqueWatchedSeconds: 0 }), 'notStarted');
    assert.equal(watchStatusKey({ uniqueWatchedSeconds: 10, progressPercentage: 4 }), 'inProgress');
    assert.equal(watchStatusKey({ completedAt: '2026-09-12' }), 'completed');
  });
});

describe('recorded lecture student player wiring', () => {
  it('embeds YouTube inside LMS with heartbeat APIs and Arabic watch states', () => {
    const player = readSrc('../src/pages/student/fieldTraining/components/YouTubeRecordedLecturePlayer.jsx');
    const shell = readSrc('../src/pages/student/fieldTraining/components/RecordedLecturePlayer.jsx');
    const page = readSrc('../src/pages/student/StudentRecordedLecturePlayerPage.jsx');
    const tab = readSrc('../src/pages/student/fieldTraining/components/StudentRecordedLecturesTab.jsx');
    const service = readSrc('../src/features/fieldTraining/fieldTraining.service.js');
    const ar = readSrc('../src/i18n/locales/ar/fieldTraining.json');
    const router = readSrc('../src/app/router/index.jsx');
    assert.match(player, /youtube\.com\/iframe_api/);
    assert.match(shell, /YouTubeRecordedLecturePlayer/);
    assert.match(page, /RecordedLecturePlayer/);
    assert.match(tab, /studentWatch\.\$\{ctaKey\}/);
    assert.match(service, /watch-session/);
    assert.match(service, /heartbeat/);
    assert.equal(/YOUTUBE_API_KEY/.test(player + service), false);
    assert.match(ar, /لم يبدأ/);
    assert.match(ar, /قيد المشاهدة/);
    assert.match(ar, /تمت المشاهدة/);
    assert.match(ar, /متابعة المشاهدة/);
    assert.match(router, /recorded-lectures\/:lectureId/);
    assert.equal(/attendancePercentage|officialResult/.test(page), false);
    assert.match(tab, /emptyAvailable/);
    assert.match(tab, /studentWatch\.\$\{ctaKey\}/);
    assert.match(ar, /startWatching/);
    assert.match(ar, /watchAgain/);
    assert.equal(/fetchStudentRecordedLecture\(/.test(tab), false);
    assert.match(tab, /useStudentRecordedLectures/);
    assert.match(page, /restartFromStart/);
    assert.match(page, /seekApiRef\.current\?\.\(0\)/);
    assert.equal(/completedAt\s*=\s*null/.test(page), false);
    assert.match(page, /studentWatch.previous/);
    assert.match(page, /studentWatch.next/);
    assert.match(page, /unavailable/);
    assert.match(page, /ft-ltr-num/);
    assert.match(tab, /ft-ltr-num/);
    assert.equal(/حضور التسجيل|Attendance: 20|YOUTUBE_API_KEY/.test(tab + page + ar), false);
    assert.equal(/dangerouslySetInnerHTML/.test(page + tab + player), false);
    const hook = readSrc('../src/pages/student/fieldTraining/components/useRecordedLectureWatchTracking.js');
    assert.match(hook, /patchRecordedLectureProgressCache/);
    assert.equal(/invalidateQueries/.test(hook), false);
    assert.match(hook, /flushExit\(\);/);
    assert.match(hook, /\.\.\/\.\.\/\.\.\/\.\.\/utils\/storage\.js/);
    assert.match(player, /\.\.\/\.\.\/\.\.\/\.\.\/features\/fieldTraining\/recordedLectureWatchTracker/);
    const keys = readSrc('../src/features/fieldTraining/hooks/fieldTrainingQueryKeys.js');
    assert.match(keys, /recordedLectures: \(opportunityId, scope/);
    assert.match(keys, /studentRecordedLecture: \(opportunityId, lectureId\)/);
    const arJson = JSON.parse(ar);
    assert.equal(arJson.recordedLectures.studentWatch.emptyAvailable, 'لا توجد محاضرات مسجلة متاحة حاليًا.');
    assert.equal(arJson.recordedLectures.studentWatch.startWatching, 'بدء المشاهدة');
    assert.equal(arJson.recordedLectures.studentWatch.watchAgain, 'مشاهدة مرة أخرى');
    assert.equal(arJson.recordedLectures.studentWatch.progressLabel, 'تقدم المشاهدة');
  });
});
