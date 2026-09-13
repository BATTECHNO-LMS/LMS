'use strict';

const { z } = require('zod');
const { MSG } = require('./fieldTraining.recordedLectures.constants');

const lectureIdParamSchema = z.object({
  lectureId: z.string().uuid(),
});

const opportunityLectureParamSchema = z.object({
  id: z.string().uuid(),
  lectureId: z.string().uuid(),
});

const optionalTrimmed = (max) =>
  z
    .string()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => {
      if (v == null) return v;
      const t = String(v).trim();
      return t === '' ? null : t;
    });

const createRecordedLectureBodySchema = z
  .object({
    title: z.string().trim().min(1, MSG.titleRequired).max(255),
    provider: z.string().trim().min(1),
    provider_video_id: z.string().optional(),
    providerVideoId: z.string().optional(),
    source_type: z.string().optional(),
    sourceType: z.string().optional(),
    source_playlist_id: optionalTrimmed(128),
    sourcePlaylistId: optionalTrimmed(128),
    source_playlist_url: optionalTrimmed(2000),
    sourcePlaylistUrl: optionalTrimmed(2000),
    description: optionalTrimmed(20000),
    thumbnail_url: optionalTrimmed(1000),
    thumbnailUrl: optionalTrimmed(1000),
    duration_seconds: z.coerce.number().int().min(0, MSG.durationInvalid).optional().nullable(),
    durationSeconds: z.coerce.number().int().min(0, MSG.durationInvalid).optional().nullable(),
    lecture_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
    lectureDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
    instructor_name: optionalTrimmed(255),
    instructorName: optionalTrimmed(255),
    sort_order: z.coerce.number().int().min(0, MSG.sortOrderInvalid).optional(),
    sortOrder: z.coerce.number().int().min(0, MSG.sortOrderInvalid).optional(),
    status: z.string().optional(),
    session_id: z.string().uuid().optional().nullable(),
    sessionId: z.string().uuid().optional().nullable(),
  })
  .transform((body) => ({
    title: body.title.trim(),
    provider: body.provider,
    provider_video_id: String(body.provider_video_id ?? body.providerVideoId ?? '').trim(),
    source_type: body.source_type ?? body.sourceType,
    source_playlist_id: body.source_playlist_id ?? body.sourcePlaylistId ?? null,
    source_playlist_url: body.source_playlist_url ?? body.sourcePlaylistUrl ?? null,
    description: body.description ?? null,
    thumbnail_url: body.thumbnail_url ?? body.thumbnailUrl ?? null,
    duration_seconds:
      body.duration_seconds !== undefined ? body.duration_seconds : body.durationSeconds ?? null,
    lecture_date: body.lecture_date ?? body.lectureDate ?? null,
    instructor_name: body.instructor_name ?? body.instructorName ?? null,
    sort_order: body.sort_order !== undefined ? body.sort_order : body.sortOrder,
    status: body.status,
    session_id: body.session_id !== undefined ? body.session_id : body.sessionId ?? null,
  }));

const updateRecordedLectureBodySchema = z
  .object({
    title: z.string().trim().min(1, MSG.titleRequired).max(255).optional(),
    provider: z.string().trim().min(1).optional(),
    provider_video_id: z.string().optional(),
    providerVideoId: z.string().optional(),
    source_type: z.string().optional(),
    sourceType: z.string().optional(),
    source_playlist_id: optionalTrimmed(128),
    sourcePlaylistId: optionalTrimmed(128),
    source_playlist_url: optionalTrimmed(2000),
    sourcePlaylistUrl: optionalTrimmed(2000),
    description: optionalTrimmed(20000),
    thumbnail_url: optionalTrimmed(1000),
    thumbnailUrl: optionalTrimmed(1000),
    duration_seconds: z.coerce.number().int().min(0, MSG.durationInvalid).optional().nullable(),
    durationSeconds: z.coerce.number().int().min(0, MSG.durationInvalid).optional().nullable(),
    lecture_date: z
      .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()])
      .optional(),
    lectureDate: z
      .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()])
      .optional(),
    instructor_name: optionalTrimmed(255),
    instructorName: optionalTrimmed(255),
    sort_order: z.coerce.number().int().min(0, MSG.sortOrderInvalid).optional(),
    sortOrder: z.coerce.number().int().min(0, MSG.sortOrderInvalid).optional(),
    status: z.string().optional(),
    session_id: z.union([z.string().uuid(), z.null()]).optional(),
    sessionId: z.union([z.string().uuid(), z.null()]).optional(),
  })
  .transform((body) => {
    const out = {};
    if (body.title !== undefined) out.title = body.title.trim();
    if (body.provider !== undefined) out.provider = body.provider;
    if (body.provider_video_id !== undefined || body.providerVideoId !== undefined) {
      out.provider_video_id = String(body.provider_video_id ?? body.providerVideoId ?? '').trim();
    }
    if (body.source_type !== undefined || body.sourceType !== undefined) {
      out.source_type = body.source_type ?? body.sourceType;
    }
    if (body.source_playlist_id !== undefined || body.sourcePlaylistId !== undefined) {
      out.source_playlist_id = body.source_playlist_id ?? body.sourcePlaylistId ?? null;
    }
    if (body.source_playlist_url !== undefined || body.sourcePlaylistUrl !== undefined) {
      out.source_playlist_url = body.source_playlist_url ?? body.sourcePlaylistUrl ?? null;
    }
    if (body.description !== undefined) out.description = body.description;
    if (body.thumbnail_url !== undefined || body.thumbnailUrl !== undefined) {
      out.thumbnail_url = body.thumbnail_url ?? body.thumbnailUrl ?? null;
    }
    if (body.duration_seconds !== undefined || body.durationSeconds !== undefined) {
      out.duration_seconds =
        body.duration_seconds !== undefined ? body.duration_seconds : body.durationSeconds;
    }
    if (body.lecture_date !== undefined || body.lectureDate !== undefined) {
      out.lecture_date = body.lecture_date !== undefined ? body.lecture_date : body.lectureDate;
    }
    if (body.instructor_name !== undefined || body.instructorName !== undefined) {
      out.instructor_name = body.instructor_name ?? body.instructorName ?? null;
    }
    if (body.sort_order !== undefined || body.sortOrder !== undefined) {
      out.sort_order = body.sort_order !== undefined ? body.sort_order : body.sortOrder;
    }
    if (body.status !== undefined) out.status = body.status;
    if (body.session_id !== undefined || body.sessionId !== undefined) {
      out.session_id = body.session_id !== undefined ? body.session_id : body.sessionId;
    }
    return out;
  });

const changeLectureStatusBodySchema = z.object({
  status: z.string().trim().min(1),
});

const youtubeUrlBodySchema = z.object({
  url: z.string().trim().min(1, MSG.youtubeUrlInvalid).max(2000),
});

const youtubePlaylistImportBodySchema = z.object({
  url: z.string().trim().min(1, MSG.youtubeUrlInvalid).max(2000),
  import_all: z.coerce.boolean().optional(),
  importAll: z.coerce.boolean().optional(),
  video_ids: z.array(z.string().trim().min(1).max(128)).max(2000).optional(),
  videoIds: z.array(z.string().trim().min(1).max(128)).max(2000).optional(),
});

const reorderLecturesBodySchema = z
  .object({
    lecture_ids: z.array(z.string().uuid()).max(2000).optional(),
    lectureIds: z.array(z.string().uuid()).max(2000).optional(),
  })
  .transform((body) => ({
    lecture_ids: Array.isArray(body.lecture_ids)
      ? body.lecture_ids
      : Array.isArray(body.lectureIds)
        ? body.lectureIds
        : [],
  }));

const youtubePlaylistSyncBodySchema = z.object({
  playlist_id: optionalTrimmed(128),
  playlistId: optionalTrimmed(128),
  import_all: z.coerce.boolean().optional(),
  importAll: z.coerce.boolean().optional(),
  video_ids: z.array(z.string().trim().min(1).max(128)).max(2000).optional(),
  videoIds: z.array(z.string().trim().min(1).max(128)).max(2000).optional(),
});

const nonNegInt = z.coerce.number().int().min(0).max(86400 * 7);

const watchSessionBodySchema = z
  .object({
    watchSessionId: z.string().uuid().optional(),
    watch_session_id: z.string().uuid().optional(),
  })
  .transform((body) => ({
    watchSessionId: body.watchSessionId || body.watch_session_id || undefined,
  }));

const heartbeatBodySchema = z
  .object({
    watchSessionId: z.string().uuid().optional(),
    watch_session_id: z.string().uuid().optional(),
    sequenceNumber: nonNegInt.optional(),
    sequence_number: nonNegInt.optional(),
    fromSecond: nonNegInt.optional(),
    from_second: nonNegInt.optional(),
    toSecond: nonNegInt.optional(),
    to_second: nonNegInt.optional(),
    currentTime: nonNegInt.optional(),
    current_time: nonNegInt.optional(),
    playerState: z.string().trim().min(1).max(32).optional(),
    player_state: z.string().trim().min(1).max(32).optional(),
  })
  .superRefine((body, ctx) => {
    if (body.fromSecond == null && body.from_second == null) {
      ctx.addIssue({ code: 'custom', message: 'fromSecond is required', path: ['fromSecond'] });
    }
    if (body.toSecond == null && body.to_second == null) {
      ctx.addIssue({ code: 'custom', message: 'toSecond is required', path: ['toSecond'] });
    }
    if (!body.playerState && !body.player_state) {
      ctx.addIssue({ code: 'custom', message: 'playerState is required', path: ['playerState'] });
    }
    if (!body.watchSessionId && !body.watch_session_id) {
      ctx.addIssue({ code: 'custom', message: 'watchSessionId is required', path: ['watchSessionId'] });
    }
    if (body.sequenceNumber == null && body.sequence_number == null) {
      ctx.addIssue({ code: 'custom', message: 'sequenceNumber is required', path: ['sequenceNumber'] });
    }
    const from = body.fromSecond ?? body.from_second;
    const to = body.toSecond ?? body.to_second;
    if (from != null && to != null && Number(from) > Number(to)) {
      ctx.addIssue({ code: 'custom', message: 'fromSecond must be <= toSecond', path: ['fromSecond'] });
    }
  })
  .transform((body) => ({
    watchSessionId: body.watchSessionId || body.watch_session_id,
    sequenceNumber: body.sequenceNumber ?? body.sequence_number,
    fromSecond: body.fromSecond ?? body.from_second,
    toSecond: body.toSecond ?? body.to_second,
    currentTime: body.currentTime ?? body.current_time ?? body.toSecond ?? body.to_second,
    playerState: body.playerState || body.player_state,
  }));

const playerEventBodySchema = z
  .object({
    watchSessionId: z.string().uuid().optional(),
    watch_session_id: z.string().uuid().optional(),
    sequenceNumber: nonNegInt.optional(),
    sequence_number: nonNegInt.optional(),
    fromSecond: nonNegInt.optional(),
    from_second: nonNegInt.optional(),
    toSecond: nonNegInt.optional(),
    to_second: nonNegInt.optional(),
    currentTime: nonNegInt.optional(),
    current_time: nonNegInt.optional(),
    playerState: z.string().trim().min(1).max(32).optional(),
    player_state: z.string().trim().min(1).max(32).optional(),
    event: z.string().trim().min(1).max(32).optional(),
  })
  .transform((body) => ({
    watchSessionId: body.watchSessionId || body.watch_session_id,
    sequenceNumber: body.sequenceNumber ?? body.sequence_number,
    fromSecond: body.fromSecond ?? body.from_second,
    toSecond: body.toSecond ?? body.to_second,
    currentTime: body.currentTime ?? body.current_time,
    playerState: body.playerState || body.player_state || body.event,
  }));

module.exports = {
  lectureIdParamSchema,
  opportunityLectureParamSchema,
  createRecordedLectureBodySchema,
  updateRecordedLectureBodySchema,
  changeLectureStatusBodySchema,
  youtubeUrlBodySchema,
  youtubePlaylistImportBodySchema,
  reorderLecturesBodySchema,
  youtubePlaylistSyncBodySchema,
  watchSessionBodySchema,
  heartbeatBodySchema,
  playerEventBodySchema,
};
