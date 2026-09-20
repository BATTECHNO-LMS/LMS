'use strict';

const { prisma } = require('../../config/db');

const watchLectureSelect = {
  id: true,
  opportunity_id: true,
  status: true,
  duration_seconds: true,
  provider: true,
  provider_video_id: true,
  title: true,
};

const progressIncludeSegments = {
  field_training_recorded_lecture_watch_segments: {
    orderBy: [{ start_second: 'asc' }, { end_second: 'asc' }],
  },
};

function mapProgressRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    lecture_id: row.lecture_id,
    application_id: row.application_id,
    student_id: row.student_id,
    video_duration_seconds: row.video_duration_seconds,
    unique_watched_seconds: row.unique_watched_seconds,
    total_playback_seconds: row.total_playback_seconds,
    last_position_seconds: row.last_position_seconds,
    progress_percentage: row.progress_percentage == null ? null : Number(row.progress_percentage),
    started_at: row.started_at,
    last_watched_at: row.last_watched_at,
    completed_at: row.completed_at,
    heartbeat_cursors: row.heartbeat_cursors && typeof row.heartbeat_cursors === 'object' ? row.heartbeat_cursors : {},
    created_at: row.created_at,
    updated_at: row.updated_at,
    segments: Array.isArray(row.field_training_recorded_lecture_watch_segments)
      ? row.field_training_recorded_lecture_watch_segments.map((seg) => ({
          id: seg.id,
          start_second: seg.start_second,
          end_second: seg.end_second,
        }))
      : [],
  };
}

async function findPublishedLecture(lectureId) {
  return prisma.field_training_recorded_lectures.findUnique({
    where: { id: lectureId },
    select: watchLectureSelect,
  });
}

async function findApprovedApplication(opportunityId, studentId) {
  return prisma.field_training_applications.findUnique({
    where: {
      opportunity_id_student_id: { opportunity_id: opportunityId, student_id: studentId },
    },
    select: {
      id: true,
      opportunity_id: true,
      student_id: true,
      status: true,
      training_status: true,
      expelled_at: true,
    },
  });
}

async function listProgressByApplicationAndLectureIds(applicationId, lectureIds) {
  if (!applicationId || !Array.isArray(lectureIds) || !lectureIds.length) return [];
  return prisma.field_training_recorded_lecture_progress.findMany({
    where: {
      application_id: applicationId,
      lecture_id: { in: lectureIds },
    },
  });
}

async function ensureProgress({ lectureId, applicationId, studentId, videoDurationSeconds }) {
  const existing = await prisma.field_training_recorded_lecture_progress.findUnique({
    where: {
      lecture_id_application_id: { lecture_id: lectureId, application_id: applicationId },
    },
    include: progressIncludeSegments,
  });
  if (existing) return mapProgressRow(existing);
  try {
    const created = await prisma.field_training_recorded_lecture_progress.create({
      data: {
        lecture_id: lectureId,
        application_id: applicationId,
        student_id: studentId,
        video_duration_seconds: videoDurationSeconds ?? null,
      },
      include: progressIncludeSegments,
    });
    return mapProgressRow(created);
  } catch (err) {
    if (err?.code !== 'P2002') throw err;
    const raced = await prisma.field_training_recorded_lecture_progress.findUnique({
      where: {
        lecture_id_application_id: { lecture_id: lectureId, application_id: applicationId },
      },
      include: progressIncludeSegments,
    });
    return mapProgressRow(raced);
  }
}

function isRetryableTxError(err) {
  const code = String(err?.code || '');
  return code === 'P2034' || code === 'P2024';
}

async function applyHeartbeatTransaction({
  progressId,
  next,
  segments,
  duplicate,
}) {
  const maxAttempts = 3;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const current = await tx.field_training_recorded_lecture_progress.findUnique({
          where: { id: progressId },
          include: progressIncludeSegments,
        });
        if (!current) return null;
        if (duplicate) {
          return mapProgressRow(current);
        }
        await tx.field_training_recorded_lecture_watch_segments.deleteMany({
          where: { progress_id: progressId },
        });
        if (segments.length) {
          await tx.field_training_recorded_lecture_watch_segments.createMany({
            data: segments.map(([start, end]) => ({
              progress_id: progressId,
              start_second: start,
              end_second: end,
            })),
          });
        }
        const updated = await tx.field_training_recorded_lecture_progress.update({
          where: { id: progressId },
          data: {
            video_duration_seconds: next.video_duration_seconds,
            unique_watched_seconds: next.unique_watched_seconds,
            total_playback_seconds: next.total_playback_seconds,
            last_position_seconds: next.last_position_seconds,
            progress_percentage: next.progress_percentage,
            started_at: next.started_at,
            last_watched_at: next.last_watched_at,
            completed_at: next.completed_at,
            heartbeat_cursors: next.heartbeat_cursors,
            updated_at: new Date(),
          },
          include: progressIncludeSegments,
        });
        return mapProgressRow(updated);
      });
    } catch (err) {
      lastErr = err;
      if (!isRetryableTxError(err) || attempt === maxAttempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
    }
  }
  throw lastErr;
}

module.exports = {
  mapProgressRow,
  findPublishedLecture,
  findApprovedApplication,
  listProgressByApplicationAndLectureIds,
  ensureProgress,
  applyHeartbeatTransaction,
  watchLectureSelect,
};
