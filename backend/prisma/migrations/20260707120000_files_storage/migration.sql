-- Object storage metadata (Cloudflare R2 / local presigned flow)
CREATE TYPE "file_visibility" AS ENUM ('public', 'private');

CREATE TABLE IF NOT EXISTS "files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "created_by_id" UUID,
    "related_entity_type" VARCHAR(100),
    "related_entity_id" UUID,
    "original_name" VARCHAR(500) NOT NULL,
    "storage_key" VARCHAR(1024) NOT NULL,
    "bucket" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(255) NOT NULL,
    "size" BIGINT NOT NULL,
    "visibility" "file_visibility" NOT NULL DEFAULT 'private',
    "url" VARCHAR(2048),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "files_storage_key_key" ON "files"("storage_key");
CREATE INDEX IF NOT EXISTS "idx_files_user_id" ON "files"("user_id");
CREATE INDEX IF NOT EXISTS "idx_files_created_by_id" ON "files"("created_by_id");
CREATE INDEX IF NOT EXISTS "idx_files_related_entity" ON "files"("related_entity_type", "related_entity_id");
CREATE INDEX IF NOT EXISTS "idx_files_deleted_at" ON "files"("deleted_at");
