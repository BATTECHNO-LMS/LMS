const { ApiError } = require('../../utils/apiError');
const { prisma } = require('../../config/db');
const microCredentialsRepository = require('./microCredentials.repository');
const learningOutcomesRepository = require('../learning-outcomes/learningOutcomes.repository');

function serializeMicro(row, extras = {}) {
  if (!row) return null;
  return {
    ...row,
    duration_hours: row.duration_hours != null ? Number(row.duration_hours) : null,
    ...extras,
  };
}

function hasSufficientAcademicData(mc) {
  if (!mc.title?.trim() || !mc.code?.trim() || !mc.level?.trim()) return false;
  const hrs = mc.duration_hours != null ? Number(mc.duration_hours) : 0;
  if (!(hrs > 0)) return false;
  if (!mc.delivery_mode) return false;
  const desc = mc.description?.trim() ?? '';
  if (desc.length < 10) return false;
  return true;
}

function buildListWhere(query, scopedMicroIds) {
  const parts = [];
  if (query.track_id) parts.push({ track_id: query.track_id });
  if (query.status) parts.push({ status: query.status });
  if (query.internal_approval_status) parts.push({ internal_approval_status: query.internal_approval_status });
  if (query.search) {
    parts.push({
      OR: [
        { title: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { level: { contains: query.search, mode: 'insensitive' } },
      ],
    });
  }
  if (scopedMicroIds) {
    parts.push({ id: { in: scopedMicroIds } });
  }
  if (!parts.length) return {};
  if (parts.length === 1) return parts[0];
  return { AND: parts };
}

async function enrichMicroCredential(row) {
  const links = await microCredentialsRepository.findUniversityLinks(row.id);
  const linked_university_ids = links.map((l) => l.university_id);
  const loCount = await learningOutcomesRepository.countByMicroCredentialId(row.id);
  const track = await microCredentialsRepository.findTrackById(row.track_id);
  return serializeMicro(row, {
    linked_university_ids,
    learning_outcomes_count: loCount,
    track: track ? { id: track.id, name: track.name, code: track.code, status: track.status } : null,
  });
}

async function listMicroCredentials(query, requester) {
  let scopedIds = null;
  if (!requester.isGlobal && requester.universityId) {
    scopedIds = await microCredentialsRepository.findMicroCredentialIdsForUniversity(requester.universityId);
    if (!scopedIds.length) return { micro_credentials: [] };
  }
  const where = buildListWhere(query, scopedIds);
  const rows = await microCredentialsRepository.findMany(where);
  const enriched = await Promise.all(rows.map((r) => enrichMicroCredential(r)));
  return { micro_credentials: enriched };
}

async function getMicroCredentialById(id, requester) {
  const row = await microCredentialsRepository.findById(id);
  if (!row) throw new ApiError(404, 'Micro-credential not found');

  if (!requester.isGlobal && requester.universityId) {
    const links = await microCredentialsRepository.findUniversityLinks(id);
    const ok = links.some((l) => l.university_id === requester.universityId);
    if (!ok) throw new ApiError(403, 'Forbidden');
  }

  return enrichMicroCredential(row);
}

async function assertUniversitiesExist(ids) {
  if (!ids.length) return;
  const rows = await prisma.universities.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  const found = new Set(rows.map((r) => r.id));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length) throw new ApiError(400, `Unknown university id(s): ${missing.join(', ')}`);
}

async function createMicroCredential(body, requester) {
  const track = await microCredentialsRepository.findTrackById(body.track_id);
  if (!track) throw new ApiError(404, 'Track not found');

  const taken = await microCredentialsRepository.findByCode(body.code);
  if (taken) throw new ApiError(409, 'Micro-credential code already exists');

  await assertUniversitiesExist(body.university_ids);

  const id = await prisma.$transaction(async (tx) => {
    const created = await microCredentialsRepository.create(
      {
        track_id: body.track_id,
        title: body.title,
        code: body.code,
        description: body.description ?? null,
        level: body.level,
        duration_hours: body.duration_hours,
        delivery_mode: body.delivery_mode,
        prerequisites: body.prerequisites ?? null,
        passing_policy: body.passing_policy ?? null,
        attendance_policy: body.attendance_policy ?? null,
        internal_approval_status: body.internal_approval_status,
        status: body.status,
      },
      tx
    );
    await microCredentialsRepository.replaceUniversityLinks(created.id, body.university_ids, tx);
    return created.id;
  });

  return getMicroCredentialById(id, requester);
}

async function updateMicroCredential(id, body, requester) {
  await getMicroCredentialById(id, requester);

  if (body.track_id) {
    const track = await microCredentialsRepository.findTrackById(body.track_id);
    if (!track) throw new ApiError(404, 'Track not found');
  }

  if (body.code) {
    const taken = await microCredentialsRepository.findByCode(body.code);
    if (taken && taken.id !== id) throw new ApiError(409, 'Micro-credential code already exists');
  }

  if (body.university_ids) {
    await assertUniversitiesExist(body.university_ids);
  }

  const data = { updated_at: new Date() };
  if (body.track_id !== undefined) data.track_id = body.track_id;
  if (body.title !== undefined) data.title = body.title;
  if (body.code !== undefined) data.code = body.code;
  if (body.description !== undefined) data.description = body.description;
  if (body.level !== undefined) data.level = body.level;
  if (body.duration_hours !== undefined) data.duration_hours = body.duration_hours;
  if (body.delivery_mode !== undefined) data.delivery_mode = body.delivery_mode;
  if (body.prerequisites !== undefined) data.prerequisites = body.prerequisites;
  if (body.passing_policy !== undefined) data.passing_policy = body.passing_policy;
  if (body.attendance_policy !== undefined) data.attendance_policy = body.attendance_policy;
  if (body.internal_approval_status !== undefined) data.internal_approval_status = body.internal_approval_status;
  if (body.status !== undefined) data.status = body.status;

  await prisma.$transaction(async (tx) => {
    const hasMcFieldUpdates = Object.keys(data).length > 1;
    if (hasMcFieldUpdates) {
      await microCredentialsRepository.update(id, data, tx);
    }
    if (body.university_ids !== undefined) {
      await microCredentialsRepository.replaceUniversityLinks(id, body.university_ids, tx);
    }
  });

  return getMicroCredentialById(id, requester);
}

async function patchMicroCredentialStatus(id, { status }, requester) {
  const row = await microCredentialsRepository.findById(id);
  if (!row) throw new ApiError(404, 'Micro-credential not found');

  if (!requester.isGlobal && requester.universityId) {
    const links = await microCredentialsRepository.findUniversityLinks(id);
    const ok = links.some((l) => l.university_id === requester.universityId);
    if (!ok) throw new ApiError(403, 'Forbidden');
  }

  const loCount = await learningOutcomesRepository.countByMicroCredentialId(id);

  if (status === 'active') {
    if (row.internal_approval_status !== 'approved') {
      throw new ApiError(
        400,
        'Cannot activate micro-credential until internal approval status is approved'
      );
    }
  }

  if (status === 'under_review') {
    if (loCount < 1) {
      throw new ApiError(400, 'Cannot move to under review without at least one learning outcome');
    }
    if (!hasSufficientAcademicData(row)) {
      throw new ApiError(
        400,
        'Cannot move to under review: complete title, code, level, duration, delivery mode, and description (min 10 characters)'
      );
    }
  }

  await microCredentialsRepository.update(id, { status, updated_at: new Date() });
  return getMicroCredentialById(id, requester);
}

module.exports = {
  listMicroCredentials,
  getMicroCredentialById,
  createMicroCredential,
  updateMicroCredential,
  patchMicroCredentialStatus,
};
