const { z } = require('zod');
const { ALLOWED_FOLDERS } = require('../../shared/storage/fileRules');

const folderSchema = z.enum(ALLOWED_FOLDERS);

const visibilitySchema = z.enum(['public', 'private']);

const presignUploadBodySchema = z.object({
  fileName: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(255),
  size: z.coerce.number().int().positive(),
  folder: folderSchema,
  visibility: visibilitySchema.default('private'),
  relatedEntityType: z.string().max(100).optional().nullable(),
  relatedEntityId: z.string().uuid().optional().nullable(),
});

const confirmUploadBodySchema = z.object({
  storageKey: z.string().min(1).max(1024),
  originalName: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(255),
  size: z.coerce.number().int().positive(),
  visibility: visibilitySchema.default('private'),
  relatedEntityType: z.string().max(100).optional().nullable(),
  relatedEntityId: z.string().uuid().optional().nullable(),
});

const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

module.exports = {
  presignUploadBodySchema,
  confirmUploadBodySchema,
  uuidParamSchema,
};
