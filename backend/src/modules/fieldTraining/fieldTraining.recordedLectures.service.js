'use strict';

const { ApiError } = require('../../utils/apiError');
const { recordAudit: defaultRecordAudit } = require('../../utils/auditRecorder');
const { toDateOnly } = require('../../utils/dateOnly');
const ftRepoDefault = require('./fieldTraining.repository');
const lectureRepoDefault = require('./fieldTraining.recordedLectures.repository');
const access = require('./fieldTraining.access');
const workflow = require('./fieldTraining.workflow');
const ftEligibility = require('./fieldTraining.eligibility');
const providerAdapter = require('./fieldTraining.recordedLectures.provider');
const watchServiceDefault = require('./fieldTraining.recordedLectures.watch.service');
const {
  PROVIDERS,
  SOURCE_TYPES,
  STATUSES,
  AUDIT,
  MSG,
  PROVIDER_API,
} = require('./fieldTraining.recordedLectures.constants');

const ENTITY_TYPE = 'field_training_recorded_lecture';

function nextSortOrder(maxSort) {
  return (maxSort == null ? -1 : maxSort) + 1;
}

function normalizeSourceType(value, { required = false } = {}) {
  if (value == null || String(value).trim() === '') {
    if (required) {
      throw new ApiError(400, MSG.sourceTypeInvalid, null, 'RECORDED_LECTURE_SOURCE_TYPE_INVALID');
    }
    return SOURCE_TYPES.SINGLE;
  }
  const key = String(value).trim().toLowerCase();
  if (key === SOURCE_TYPES.SINGLE || key === 'single') return SOURCE_TYPES.SINGLE;
  if (key === SOURCE_TYPES.PLAYLIST || key === 'playlist') return SOURCE_TYPES.PLAYLIST;
  throw new ApiError(400, MSG.sourceTypeInvalid, null, 'RECORDED_LECTURE_SOURCE_TYPE_INVALID');
}

function normalizeStatus(value, { required = false, fallback = STATUSES.DRAFT } = {}) {
  if (value == null || String(value).trim() === '') {
    if (required) {
      throw new ApiError(400, MSG.statusInvalid, null, 'RECORDED_LECTURE_STATUS_INVALID');
    }
    return fallback;
  }
  const key = String(value).trim().toLowerCase();
  if (key === STATUSES.DRAFT) return STATUSES.DRAFT;
  if (key === STATUSES.PUBLISHED) return STATUSES.PUBLISHED;
  if (key === STATUSES.HIDDEN) return STATUSES.HIDDEN;
  throw new ApiError(400, MSG.statusInvalid, null, 'RECORDED_LECTURE_STATUS_INVALID');
}

function applySourceFields(sourceType, playlistId, playlistUrl) {
  if (sourceType === SOURCE_TYPES.SINGLE) {
    return { source_playlist_id: null, source_playlist_url: null };
  }
  return {
    source_playlist_id: playlistId ?? null,
    source_playlist_url: playlistUrl ?? null,
  };
}

function mapDuplicateError(err) {
  if (err?.code !== 'P2002') return null;
  const targets = Array.isArray(err?.meta?.target) ? err.meta.target.map(String) : [];
  const hit = targets.some((t) =>
    /provider_video|provider|opportunity/i.test(t) || t.includes('uq_ft_recorded_lectures')
  );
  if (!hit && targets.length) return null;
  return new ApiError(409, MSG.duplicate, null, 'RECORDED_LECTURE_DUPLICATE');
}

function publishedAtForStatus(nextStatus, previousPublishedAt, now = new Date()) {
  if (nextStatus === STATUSES.PUBLISHED) return previousPublishedAt || now;
  return previousPublishedAt ?? null;
}

function derivePlaylistSources(rows) {
  const map = new Map();
  for (const row of rows) {
    if (row.source_type !== SOURCE_TYPES.PLAYLIST || !row.source_playlist_id) continue;
    const key = `${row.provider}:${row.source_playlist_id}`;
    if (!map.has(key)) {
      map.set(key, {
        provider: PROVIDER_API[row.provider] || String(row.provider || '').toUpperCase(),
        playlistId: row.source_playlist_id,
        playlistUrl: row.source_playlist_url || null,
        lectureCount: 0,
      });
    }
    map.get(key).lectureCount += 1;
  }
  return [...map.values()];
}

function summarizeStatuses(rows) {
  const counts = { total: rows.length, draft: 0, published: 0, hidden: 0 };
  for (const row of rows) {
    if (row.status === STATUSES.PUBLISHED) counts.published += 1;
    else if (row.status === STATUSES.HIDDEN) counts.hidden += 1;
    else counts.draft += 1;
  }
  return counts;
}

async function defaultAssertStudentCanAccessOpportunity(opportunity, studentId) {
  const scope = await access.requireStudentFieldTrainingScope(studentId);
  const eligible = await ftEligibility.isStudentEligible(
    opportunity.id,
    scope.universityId,
    scope.universitySpecialtyId
  );
  if (!eligible) {
    throw new ApiError(403, access.NOT_ELIGIBLE_MSG, null, 'FIELD_TRAINING_NOT_ELIGIBLE');
  }
}

function createService(deps = {}) {
  const lectureRepo = deps.lectureRepo || lectureRepoDefault;
  const ftRepo = deps.ftRepo || ftRepoDefault;
  const recordAudit = deps.recordAudit || defaultRecordAudit;
  const watchService =
    deps.watchService || (deps.lectureRepo ? null : watchServiceDefault);
  const assertStudentCanAccessOpportunity =
    deps.assertStudentCanAccessOpportunity || defaultAssertStudentCanAccessOpportunity;

  async function loadOpportunity(opportunityId) {
    const opp = await ftRepo.findById(opportunityId);
    if (!opp) throw new ApiError(404, MSG.opportunityNotFound, null, 'OPPORTUNITY_NOT_FOUND');
    return opp;
  }

  async function assertSessionSameOpportunity(sessionId, opportunityId) {
    if (!sessionId) return null;
    const session = await ftRepo.findSessionById(sessionId);
    if (!session) throw new ApiError(404, MSG.sessionNotFound, null, 'SESSION_NOT_FOUND');
    if (String(session.opportunity_id) !== String(opportunityId)) {
      throw new ApiError(400, MSG.sessionMismatch, null, 'RECORDED_LECTURE_SESSION_MISMATCH');
    }
    return session;
  }

  async function requireStudentEnrollment(opportunityId, studentId) {
    const opp = await ftRepo.findPublishedById(opportunityId);
    if (!opp) throw new ApiError(404, MSG.opportunityNotFound, null, 'OPPORTUNITY_NOT_FOUND');
    await assertStudentCanAccessOpportunity(opp, studentId);
    const app = await ftRepo.findApplicationByOpportunityAndStudent(opportunityId, studentId);
    if (!app || app.status !== 'approved' || workflow.isExpelled(app)) {
      throw new ApiError(403, MSG.forbidden, null, 'RECORDED_LECTURE_FORBIDDEN');
    }
    return { opp, app };
  }

  async function audit(user, actionType, lecture, extra = {}) {
    await recordAudit({
      userId: user?.userId ?? null,
      universityId: user?.universityId ?? extra.universityId ?? null,
      actionType,
      entityType: ENTITY_TYPE,
      entityId: lecture?.id ?? null,
      newValues: extra.newValues,
      oldValues: extra.oldValues,
    });
  }

  async function listForStaff(opportunityId, user) {
    const opp = await loadOpportunity(opportunityId);
    await access.assertRecordedLectureReadAccess(user, opp);
    const rows = await lectureRepo.listByOpportunity(opportunityId);
    return {
      lectures: rows.map(lectureRepo.mapLectureRow),
      playlistSources: derivePlaylistSources(rows),
      counts: summarizeStatuses(rows),
    };
  }

  async function getForStaff(lectureId, user) {
    const row = await lectureRepo.findById(lectureId);
    if (!row) throw new ApiError(404, MSG.notFound, null, 'RECORDED_LECTURE_NOT_FOUND');
    const opp = row.field_training_opportunities || (await loadOpportunity(row.opportunity_id));
    await access.assertRecordedLectureReadAccess(user, opp);
    return { lecture: lectureRepo.mapLectureRow(row) };
  }

  async function createForOpportunity(opportunityId, body, user) {
    const opp = await loadOpportunity(opportunityId);
    await access.assertRecordedLectureManageAccess(user, opp);

    const title = String(body.title || '').trim();
    if (!title) throw new ApiError(400, MSG.titleRequired, null, 'VALIDATION_ERROR');

    const ref = providerAdapter.validateVideoReference({
      provider: body.provider,
      providerVideoId: body.provider_video_id,
    });
    const sourceType = normalizeSourceType(body.source_type);
    const status = normalizeStatus(body.status);
    if (body.duration_seconds != null && body.duration_seconds < 0) {
      throw new ApiError(400, MSG.durationInvalid, null, 'VALIDATION_ERROR');
    }
    if (body.sort_order != null && body.sort_order < 0) {
      throw new ApiError(400, MSG.sortOrderInvalid, null, 'VALIDATION_ERROR');
    }

    await assertSessionSameOpportunity(body.session_id, opportunityId);

    let sortOrder = body.sort_order;
    if (sortOrder == null) {
      const maxSort = await lectureRepo.findMaxSortOrder(opportunityId);
      sortOrder = nextSortOrder(maxSort);
    }

    const sourceFields = applySourceFields(
      sourceType,
      body.source_playlist_id,
      body.source_playlist_url
    );

    let row;
    try {
      row = await lectureRepo.createLecture({
        opportunity_id: opportunityId,
        session_id: body.session_id ?? null,
        provider: ref.provider,
        provider_video_id: ref.providerVideoId,
        source_type: sourceType,
        ...sourceFields,
        title,
        description: body.description ?? null,
        thumbnail_url: body.thumbnail_url ?? null,
        duration_seconds: body.duration_seconds ?? null,
        lecture_date: body.lecture_date ? toDateOnly(body.lecture_date) : null,
        instructor_name: body.instructor_name ?? null,
        sort_order: sortOrder,
        status,
        published_at: publishedAtForStatus(status, null),
        created_by_id: user?.userId ?? null,
      });
    } catch (err) {
      const mapped = mapDuplicateError(err);
      if (mapped) throw mapped;
      throw err;
    }

    await audit(user, AUDIT.CREATED, row, {
      newValues: {
        opportunityId,
        provider: ref.provider,
        providerVideoId: ref.providerVideoId,
        status,
      },
    });
    if (status === STATUSES.PUBLISHED) {
      await audit(user, AUDIT.PUBLISHED, row, { newValues: { status } });
    }

    return { lecture: lectureRepo.mapLectureRow(row) };
  }

  async function updateLecture(lectureId, body, user) {
    const existing = await lectureRepo.findById(lectureId);
    if (!existing) throw new ApiError(404, MSG.notFound, null, 'RECORDED_LECTURE_NOT_FOUND');
    const opp = existing.field_training_opportunities || (await loadOpportunity(existing.opportunity_id));
    await access.assertRecordedLectureManageAccess(user, opp);

    const data = { updated_at: new Date() };
    if (body.title !== undefined) {
      const title = String(body.title || '').trim();
      if (!title) throw new ApiError(400, MSG.titleRequired, null, 'VALIDATION_ERROR');
      data.title = title;
    }

    if (body.provider !== undefined || body.provider_video_id !== undefined) {
      const nextProvider = body.provider !== undefined ? body.provider : existing.provider;
      const nextVideoId =
        body.provider_video_id !== undefined ? body.provider_video_id : existing.provider_video_id;
      const ref = providerAdapter.validateVideoReference({
        provider: nextProvider,
        providerVideoId: nextVideoId,
      });
      if (ref.provider !== existing.provider || ref.providerVideoId !== existing.provider_video_id) {
        throw new ApiError(400, MSG.providerImmutable, null, 'RECORDED_LECTURE_PROVIDER_IMMUTABLE');
      }
    }

    if (body.source_type !== undefined) {
      data.source_type = normalizeSourceType(body.source_type, { required: true });
    }
    const sourceType = data.source_type || existing.source_type;
    if (
      body.source_type !== undefined ||
      body.source_playlist_id !== undefined ||
      body.source_playlist_url !== undefined
    ) {
      Object.assign(
        data,
        applySourceFields(
          sourceType,
          body.source_playlist_id !== undefined ? body.source_playlist_id : existing.source_playlist_id,
          body.source_playlist_url !== undefined
            ? body.source_playlist_url
            : existing.source_playlist_url
        )
      );
    }

    if (body.description !== undefined) data.description = body.description;
    if (body.thumbnail_url !== undefined) data.thumbnail_url = body.thumbnail_url;
    if (body.duration_seconds !== undefined) {
      if (body.duration_seconds != null && body.duration_seconds < 0) {
        throw new ApiError(400, MSG.durationInvalid, null, 'VALIDATION_ERROR');
      }
      data.duration_seconds = body.duration_seconds;
    }
    if (body.lecture_date !== undefined) {
      data.lecture_date = body.lecture_date ? toDateOnly(body.lecture_date) : null;
    }
    if (body.instructor_name !== undefined) data.instructor_name = body.instructor_name;
    if (body.sort_order !== undefined) {
      if (body.sort_order < 0) {
        throw new ApiError(400, MSG.sortOrderInvalid, null, 'VALIDATION_ERROR');
      }
      data.sort_order = body.sort_order;
    }
    if (body.session_id !== undefined) {
      await assertSessionSameOpportunity(body.session_id, existing.opportunity_id);
      data.session_id = body.session_id;
    }

    let nextStatus = existing.status;
    if (body.status !== undefined) {
      nextStatus = normalizeStatus(body.status, { required: true });
      data.status = nextStatus;
      data.published_at = publishedAtForStatus(nextStatus, existing.published_at);
    }

    let row;
    try {
      row = await lectureRepo.updateLecture(lectureId, data);
    } catch (err) {
      const mapped = mapDuplicateError(err);
      if (mapped) throw mapped;
      throw err;
    }

    if (body.status !== undefined && nextStatus !== existing.status) {
      if (nextStatus === STATUSES.PUBLISHED) {
        await audit(user, AUDIT.PUBLISHED, row, {
          oldValues: { status: existing.status },
          newValues: { status: nextStatus },
        });
      } else if (nextStatus === STATUSES.HIDDEN) {
        await audit(user, AUDIT.HIDDEN, row, {
          oldValues: { status: existing.status },
          newValues: { status: nextStatus },
        });
      } else {
        await audit(user, AUDIT.UPDATED, row, {
          oldValues: { status: existing.status },
          newValues: { status: nextStatus },
        });
      }
    } else {
      await audit(user, AUDIT.UPDATED, row, { newValues: { id: lectureId } });
    }

    return { lecture: lectureRepo.mapLectureRow(row) };
  }

  async function setStatus(lectureId, status, user) {
    return updateLecture(lectureId, { status: normalizeStatus(status, { required: true }) }, user);
  }

  async function reorderLectures(opportunityId, body, user) {
    const opp = await loadOpportunity(opportunityId);
    await access.assertRecordedLectureManageAccess(user, opp);
    const orderedIds = Array.isArray(body?.lecture_ids)
      ? body.lecture_ids
      : Array.isArray(body?.lectureIds)
        ? body.lectureIds
        : [];
    let rows;
    try {
      rows = await lectureRepo.reorderLectures(opportunityId, orderedIds);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(500, MSG.reorderFailed, null, 'RECORDED_LECTURE_REORDER_FAILED');
    }
    await recordAudit({
      userId: user?.userId ?? null,
      universityId: user?.universityId ?? opp.university_id ?? null,
      actionType: AUDIT.REORDERED,
      entityType: ENTITY_TYPE,
      entityId: opportunityId,
      newValues: {
        opportunityId,
        count: rows.length,
      },
    });
    return {
      lectures: rows.map(lectureRepo.mapLectureRow),
      playlistSources: derivePlaylistSources(rows),
      counts: summarizeStatuses(rows),
    };
  }

  async function attachStudentProgress(applicationId, rows) {
    const empty = watchServiceDefault.emptyStudentProgress();
    if (!watchService || !applicationId || !rows.length) {
      return rows.map((row) => ({
        ...lectureRepo.mapStudentLectureRow(row),
        progress: empty,
      }));
    }
    const progressMap = await watchService.progressByLectureIds(
      applicationId,
      rows.map((row) => row.id)
    );
    return rows.map((row) => ({
      ...lectureRepo.mapStudentLectureRow(row),
      progress: watchService.mapStudentProgress(progressMap.get(String(row.id)), {
        durationSeconds: row.duration_seconds,
      }),
    }));
  }

  async function listForStudent(opportunityId, studentId) {
    const { app } = await requireStudentEnrollment(opportunityId, studentId);
    const rows = await lectureRepo.listByOpportunity(opportunityId, { status: STATUSES.PUBLISHED });
    const lectures = await attachStudentProgress(app.id, rows);
    return {
      lectures,
      summary: {
        total: lectures.length,
        completed: lectures.filter((row) => Boolean(row.progress?.completedAt)).length,
      },
    };
  }

  async function getForStudent(opportunityId, lectureId, studentId) {
    const { app } = await requireStudentEnrollment(opportunityId, studentId);
    const row = await lectureRepo.findById(lectureId);
    if (!row || String(row.opportunity_id) !== String(opportunityId)) {
      throw new ApiError(404, MSG.notFound, null, 'RECORDED_LECTURE_NOT_FOUND');
    }
    if (row.status !== STATUSES.PUBLISHED) {
      throw new ApiError(404, MSG.notFound, null, 'RECORDED_LECTURE_NOT_FOUND');
    }
    const published = await lectureRepo.listByOpportunity(opportunityId, { status: STATUSES.PUBLISHED });
    const index = published.findIndex((item) => String(item.id) === String(lectureId));
    const previous = index > 0 ? published[index - 1] : null;
    const next = index >= 0 && index < published.length - 1 ? published[index + 1] : null;
    const [lecture] = await attachStudentProgress(app.id, [row]);
    return {
      lecture: {
        ...lecture,
        embed: providerAdapter.getEmbedReference(row),
      },
      previous: previous
        ? { id: previous.id, title: previous.title, sortOrder: previous.sort_order }
        : null,
      next: next ? { id: next.id, title: next.title, sortOrder: next.sort_order } : null,
    };
  }

  return {
    listForStaff,
    getForStaff,
    createForOpportunity,
    updateLecture,
    setStatus,
    reorderLectures,
    listForStudent,
    getForStudent,
  };
}

const service = createService();

module.exports = {
  ...service,
  createService,
  nextSortOrder,
  normalizeSourceType,
  normalizeStatus,
  applySourceFields,
  mapDuplicateError,
  publishedAtForStatus,
  derivePlaylistSources,
  PROVIDERS,
  SOURCE_TYPES,
  STATUSES,
};
