'use strict';

const { prisma } = require('../../config/db');
const { Prisma } = require('@prisma/client');
const { PRESENCE_WINDOW_SECONDS } = require('./analytics.definitions');
const { getCompletionThresholdPercent } = require('../fieldTraining/fieldTraining.recordedLectures.watch.constants');
const { intCount, safePercent, round } = require('./analytics.percent');
const { ftOppScopeSql, ftAppScopeSql } = require('./commandCenter.sql');

async function getRecordedLectureAnalytics(scope, period) {
  if (!scope.modules.recordedLectures) {
    return { available: false, reason: 'NOT_IN_SCOPE' };
  }

  const threshold = getCompletionThresholdPercent();
  const watchingCutoff = new Date(Date.now() - PRESENCE_WINDOW_SECONDS * 1000);

  const [publishedRows, progressRows, currentlyWatchingRows, topRows] = await Promise.all([
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS c
      FROM field_training_recorded_lectures l
      JOIN field_training_opportunities o ON o.id = l.opportunity_id
      WHERE l.status = 'published'::field_training_recorded_lecture_status
        ${ftOppScopeSql(scope)}
    `,
    prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (WHERE p.started_at IS NOT NULL)::int AS started,
        COUNT(*) FILTER (WHERE p.completed_at IS NOT NULL)::int AS completed,
        COUNT(DISTINCT p.student_id) FILTER (WHERE p.started_at IS NOT NULL)::int AS unique_started,
        COALESCE(SUM(p.unique_watched_seconds), 0)::bigint AS unique_seconds,
        COALESCE(SUM(p.total_playback_seconds), 0)::bigint AS playback_seconds,
        AVG(p.progress_percentage)::float AS avg_watch_pct
      FROM field_training_recorded_lecture_progress p
      JOIN field_training_recorded_lectures l ON l.id = p.lecture_id
      JOIN field_training_opportunities o ON o.id = l.opportunity_id
      JOIN field_training_applications app ON app.id = p.application_id
      WHERE l.status = 'published'::field_training_recorded_lecture_status
        ${ftOppScopeSql(scope)}
        ${ftAppScopeSql(scope)}
        AND (p.last_watched_at IS NULL OR p.last_watched_at >= ${period.periodStart})
    `,
    prisma.$queryRaw`
      SELECT COUNT(DISTINCT p.student_id)::int AS c
      FROM field_training_recorded_lecture_progress p
      JOIN field_training_recorded_lectures l ON l.id = p.lecture_id
      JOIN field_training_opportunities o ON o.id = l.opportunity_id
      WHERE p.last_watched_at >= ${watchingCutoff}
        AND p.completed_at IS NULL
        ${ftOppScopeSql(scope)}
    `,
    prisma.$queryRaw`
      SELECT
        l.id,
        l.title,
        COUNT(*) FILTER (WHERE p.started_at IS NOT NULL)::int AS started,
        COUNT(*) FILTER (WHERE p.completed_at IS NOT NULL)::int AS completed,
        COALESCE(SUM(p.unique_watched_seconds), 0)::bigint AS unique_seconds,
        AVG(p.progress_percentage)::float AS avg_watch_pct
      FROM field_training_recorded_lectures l
      JOIN field_training_opportunities o ON o.id = l.opportunity_id
      LEFT JOIN field_training_recorded_lecture_progress p ON p.lecture_id = l.id
      WHERE l.status = 'published'::field_training_recorded_lecture_status
        ${ftOppScopeSql(scope)}
      GROUP BY l.id, l.title
      ORDER BY started DESC, unique_seconds DESC
      LIMIT 5
    `,
  ]);

  const published = intCount(publishedRows[0]?.c);
  const p = progressRows[0] || {};
  const started = intCount(p.started);
  const completed = intCount(p.completed);
  const uniqueHours = round(Number(p.unique_seconds || 0) / 3600, 1);
  const playbackHours = round(Number(p.playback_seconds || 0) / 3600, 1);

  return {
    available: true,
    completionThresholdPercent: threshold,
    publishedLectures: published,
    studentsStarted: intCount(p.unique_started),
    progressRowsStarted: started,
    completed,
    completionRate: safePercent(completed, started, 1),
    uniqueWatchHours: uniqueHours,
    totalPlaybackHours: playbackHours,
    averageWatchPercentage: round(p.avg_watch_pct, 1),
    currentlyWatching: intCount(currentlyWatchingRows[0]?.c),
    topLectures: topRows.map((row) => ({
      id: row.id,
      title: row.title,
      started: intCount(row.started),
      completed: intCount(row.completed),
      completionRate: safePercent(row.completed, row.started, 1),
      uniqueWatchHours: round(Number(row.unique_seconds || 0) / 3600, 1),
      averageWatchPercentage: round(row.avg_watch_pct, 1),
    })),
  };
}

module.exports = {
  getRecordedLectureAnalytics,
};
