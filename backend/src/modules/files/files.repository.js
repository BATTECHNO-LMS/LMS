const { prisma } = require('../../config/db');

const fileSelect = {
  id: true,
  user_id: true,
  created_by_id: true,
  related_entity_type: true,
  related_entity_id: true,
  original_name: true,
  storage_key: true,
  bucket: true,
  mime_type: true,
  size: true,
  visibility: true,
  url: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
};

function mapFileRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    createdById: row.created_by_id,
    relatedEntityType: row.related_entity_type,
    relatedEntityId: row.related_entity_id,
    originalName: row.original_name,
    storageKey: row.storage_key,
    bucket: row.bucket,
    mimeType: row.mime_type,
    size: Number(row.size),
    visibility: row.visibility,
    url: row.url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

async function createFile(data) {
  const row = await prisma.files.create({
    data: {
      user_id: data.userId ?? null,
      created_by_id: data.createdById ?? null,
      related_entity_type: data.relatedEntityType ?? null,
      related_entity_id: data.relatedEntityId ?? null,
      original_name: data.originalName,
      storage_key: data.storageKey,
      bucket: data.bucket,
      mime_type: data.mimeType,
      size: BigInt(data.size),
      visibility: data.visibility || 'private',
      url: data.url ?? null,
    },
    select: fileSelect,
  });
  return mapFileRow(row);
}

async function findById(id) {
  const row = await prisma.files.findFirst({
    where: { id, deleted_at: null },
    select: fileSelect,
  });
  return mapFileRow(row);
}

async function findByStorageKey(storageKey) {
  const row = await prisma.files.findFirst({
    where: { storage_key: storageKey, deleted_at: null },
    select: fileSelect,
  });
  return mapFileRow(row);
}

async function softDelete(id) {
  const row = await prisma.files.update({
    where: { id },
    data: { deleted_at: new Date(), updated_at: new Date() },
    select: fileSelect,
  });
  return mapFileRow(row);
}

module.exports = {
  createFile,
  findById,
  findByStorageKey,
  softDelete,
  mapFileRow,
};
