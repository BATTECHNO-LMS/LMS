const { ApiError } = require('../../utils/apiError');
const tracksRepository = require('./tracks.repository');

function buildListWhere(query) {
  const parts = [];
  if (query.status) parts.push({ status: query.status });
  if (query.search) {
    parts.push({
      OR: [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ],
    });
  }
  if (!parts.length) return {};
  if (parts.length === 1) return parts[0];
  return { AND: parts };
}

async function listTracks(query) {
  const where = buildListWhere(query);
  const rows = await tracksRepository.findMany(where);
  const ids = rows.map((r) => r.id);
  const counts = await tracksRepository.countMicroCredentialsByTrackIds(ids);
  return {
    tracks: rows.map((t) => ({
      ...t,
      micro_credentials_count: counts.get(t.id) ?? 0,
    })),
  };
}

async function getTrackById(id) {
  const row = await tracksRepository.findById(id);
  if (!row) throw new ApiError(404, 'Track not found');
  const counts = await tracksRepository.countMicroCredentialsByTrackIds([id]);
  return { ...row, micro_credentials_count: counts.get(id) ?? 0 };
}

async function createTrack(body) {
  const taken = await tracksRepository.findByCode(body.code);
  if (taken) throw new ApiError(409, 'Track code already exists');
  try {
    const created = await tracksRepository.create({
      name: body.name,
      code: body.code,
      description: body.description ?? null,
      status: body.status,
    });
    return getTrackById(created.id);
  } catch (e) {
    if (e && e.code === 'P2002') throw new ApiError(409, 'Track code already exists');
    throw e;
  }
}

async function updateTrack(id, body) {
  const existing = await tracksRepository.findById(id);
  if (!existing) throw new ApiError(404, 'Track not found');

  if (body.code && body.code !== existing.code) {
    const taken = await tracksRepository.findByCode(body.code);
    if (taken) throw new ApiError(409, 'Track code already exists');
  }

  const data = { updated_at: new Date() };
  if (body.name !== undefined) data.name = body.name;
  if (body.code !== undefined) data.code = body.code;
  if (body.description !== undefined) data.description = body.description;
  if (body.status !== undefined) data.status = body.status;

  try {
    await tracksRepository.update(id, data);
    return getTrackById(id);
  } catch (e) {
    if (e && e.code === 'P2002') throw new ApiError(409, 'Track code already exists');
    throw e;
  }
}

module.exports = {
  listTracks,
  getTrackById,
  createTrack,
  updateTrack,
};
