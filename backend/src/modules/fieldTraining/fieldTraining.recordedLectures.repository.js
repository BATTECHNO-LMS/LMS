'use strict';

const { prisma } = require('../../config/db');
const { formatDateOnly } = require('../../utils/dateOnly');
const { ApiError } = require('../../utils/apiError');
const { PROVIDER_API, SOURCE_API, STATUS_API, MSG } = require('./fieldTraining.recordedLectures.constants');

const lectureSessionSelect = {
  id: true,
  title: true,
  opportunity_id: true,
  session_date: true,
};

function mapLectureRow(row) {
  if (!row) return null;
  const session = row.field_training_sessions
    ? { id: row.field_training_sessions.id, title: row.field_training_sessions.title }
    : null;
  return {
    id: row.id,
    opportunity_id: row.opportunity_id,
    session_id: row.session_id,
    session,
    provider: PROVIDER_API[row.provider] || String(row.provider || '').toUpperCase(),
    provider_video_id: row.provider_video_id,
    source_type: SOURCE_API[row.source_type] || String(row.source_type || '').toUpperCase(),
    source_playlist_id: row.source_playlist_id,
    source_playlist_url: row.source_playlist_url,
    title: row.title,
    description: row.description,
    thumbnail_url: row.thumbnail_url,
    duration_seconds: row.duration_seconds,
    lecture_date: formatDateOnly(row.lecture_date),
    instructor_name: row.instructor_name,
    sort_order: row.sort_order,
    status: STATUS_API[row.status] || String(row.status || '').toUpperCase(),
    published_at: row.published_at,
    created_by_id: row.created_by_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapStudentLectureRow(row) {
  if (!row) return null;
  const session = row.field_training_sessions;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    provider: PROVIDER_API[row.provider] || String(row.provider || '').toUpperCase(),
    providerVideoId: row.provider_video_id,
    thumbnailUrl: row.thumbnail_url,
    durationSeconds: row.duration_seconds,
    lectureDate: formatDateOnly(row.lecture_date),
    instructorName: row.instructor_name,
    sortOrder: row.sort_order,
    sessionDate: session ? formatDateOnly(session.session_date) : null,
  };
}

async function listByOpportunity(opportunityId, { status } = {}) {
  return prisma.field_training_recorded_lectures.findMany({
    where: {
      opportunity_id: opportunityId,
      ...(status ? { status } : {}),
    },
    include: {
      field_training_sessions: { select: lectureSessionSelect },
    },
    orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }, { id: 'asc' }],
  });
}

async function findById(id) {
  return prisma.field_training_recorded_lectures.findUnique({
    where: { id },
    include: {
      field_training_sessions: { select: lectureSessionSelect },
      field_training_opportunities: {
        select: {
          id: true,
          title: true,
          status: true,
          university_id: true,
          assigned_instructor_id: true,
        },
      },
    },
  });
}

async function findMaxSortOrder(opportunityId) {
  const agg = await prisma.field_training_recorded_lectures.aggregate({
    where: { opportunity_id: opportunityId },
    _max: { sort_order: true },
  });
  return agg._max.sort_order;
}

async function createLecture(data) {
  return prisma.field_training_recorded_lectures.create({
    data,
    include: {
      field_training_sessions: { select: lectureSessionSelect },
    },
  });
}

async function updateLecture(id, data) {
  return prisma.field_training_recorded_lectures.update({
    where: { id },
    data,
    include: {
      field_training_sessions: { select: lectureSessionSelect },
    },
  });
}

async function listYoutubeVideoIds(opportunityId) {
  const rows = await prisma.field_training_recorded_lectures.findMany({
    where: {
      opportunity_id: opportunityId,
      provider: 'youtube',
    },
    select: { provider_video_id: true },
  });
  return new Set(rows.map((row) => row.provider_video_id));
}

async function createManyLectures(rows) {
  if (!rows.length) return { count: 0 };
  return prisma.field_training_recorded_lectures.createMany({
    data: rows,
    skipDuplicates: true,
  });
}

function assertReorderPayload(existingIds, orderedIds) {
  const next = orderedIds.map(String);
  if (new Set(next).size !== next.length) {
    throw new ApiError(400, MSG.reorderDuplicate, null, 'RECORDED_LECTURE_REORDER_DUPLICATE');
  }
  const existing = new Set(existingIds.map(String));
  if (next.length !== existing.size) {
    throw new ApiError(400, MSG.reorderIncomplete, null, 'RECORDED_LECTURE_REORDER_INCOMPLETE');
  }
  for (const id of next) {
    if (!existing.has(id)) {
      throw new ApiError(400, MSG.reorderForeign, null, 'RECORDED_LECTURE_REORDER_FOREIGN');
    }
  }
}

async function reorderLectures(opportunityId, orderedIds) {
  try {
    return await prisma.$transaction(async (tx) => {
      const rows = await tx.field_training_recorded_lectures.findMany({
        where: { opportunity_id: opportunityId },
        select: { id: true },
      });
      assertReorderPayload(
        rows.map((row) => row.id),
        orderedIds
      );
      const now = new Date();
      for (let i = 0; i < orderedIds.length; i += 1) {
        await tx.field_training_recorded_lectures.update({
          where: { id: orderedIds[i] },
          data: { sort_order: i + 1, updated_at: now },
        });
      }
      return tx.field_training_recorded_lectures.findMany({
        where: { opportunity_id: opportunityId },
        include: {
          field_training_sessions: { select: lectureSessionSelect },
        },
        orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }, { id: 'asc' }],
      });
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(500, MSG.reorderFailed, null, 'RECORDED_LECTURE_REORDER_FAILED');
  }
}

module.exports = {
  mapLectureRow,
  mapStudentLectureRow,
  listByOpportunity,
  findById,
  findMaxSortOrder,
  createLecture,
  updateLecture,
  listYoutubeVideoIds,
  createManyLectures,
  reorderLectures,
  assertReorderPayload,
};
