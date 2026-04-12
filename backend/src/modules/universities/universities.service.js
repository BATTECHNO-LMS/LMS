const { ApiError } = require('../../utils/apiError');
const universitiesRepository = require('./universities.repository');

function normalizeCreatePayload(body) {
  return {
    name: body.name.trim(),
    type: body.type === null || body.type === undefined ? null : String(body.type).trim() || null,
    contact_person:
      body.contact_person === null || body.contact_person === undefined
        ? null
        : String(body.contact_person).trim() || null,
    contact_email:
      body.contact_email === null || body.contact_email === undefined || body.contact_email === ''
        ? null
        : String(body.contact_email).trim().toLowerCase(),
    contact_phone:
      body.contact_phone === null || body.contact_phone === undefined
        ? null
        : String(body.contact_phone).trim() || null,
    status: body.status ?? 'active',
    partnership_state: body.partnership_state ?? 'active',
    notes: body.notes === null || body.notes === undefined ? null : body.notes,
  };
}

function normalizeUpdatePayload(body) {
  const out = {};
  if (body.name !== undefined) out.name = body.name.trim();
  if (body.type !== undefined) {
    out.type = body.type === null ? null : String(body.type).trim() || null;
  }
  if (body.contact_person !== undefined) {
    out.contact_person = body.contact_person === null ? null : String(body.contact_person).trim() || null;
  }
  if (body.contact_email !== undefined) {
    out.contact_email =
      body.contact_email === null || body.contact_email === ''
        ? null
        : String(body.contact_email).trim().toLowerCase();
  }
  if (body.contact_phone !== undefined) {
    out.contact_phone = body.contact_phone === null ? null : String(body.contact_phone).trim() || null;
  }
  if (body.status !== undefined) out.status = body.status;
  if (body.partnership_state !== undefined) out.partnership_state = body.partnership_state;
  if (body.notes !== undefined) out.notes = body.notes === null ? null : body.notes;
  out.updated_at = new Date();
  return out;
}

async function listUniversities() {
  const rows = await universitiesRepository.findAllOrdered();
  return { universities: rows };
}

async function getUniversityById(id, query) {
  const row = await universitiesRepository.findById(id);
  if (!row) {
    throw new ApiError(404, 'University not found');
  }

  if (!query.include_counts) {
    return row;
  }

  const [linked_users_count, linked_micro_credentials_count] = await Promise.all([
    universitiesRepository.countLinkedUsers(id),
    universitiesRepository.countLinkedMicroCredentials(id),
  ]);

  return { ...row, linked_users_count, linked_micro_credentials_count };
}

async function createUniversity(body) {
  const payload = normalizeCreatePayload(body);
  const nameTaken = await universitiesRepository.findByName(payload.name);
  if (nameTaken) {
    throw new ApiError(409, 'University name already exists');
  }
  try {
    return await universitiesRepository.createUniversity(payload);
  } catch (e) {
    if (e && e.code === 'P2002') {
      throw new ApiError(409, 'University name already exists');
    }
    throw e;
  }
}

async function updateUniversity(id, body) {
  const existing = await universitiesRepository.findById(id);
  if (!existing) {
    throw new ApiError(404, 'University not found');
  }

  const payload = normalizeUpdatePayload(body);
  if (payload.name) {
    const other = await universitiesRepository.findByName(payload.name);
    if (other && other.id !== id) {
      throw new ApiError(409, 'University name already exists');
    }
  }

  try {
    return await universitiesRepository.updateUniversity(id, payload);
  } catch (e) {
    if (e && e.code === 'P2002') {
      throw new ApiError(409, 'University name already exists');
    }
    throw e;
  }
}

module.exports = {
  listUniversities,
  getUniversityById,
  createUniversity,
  updateUniversity,
};
