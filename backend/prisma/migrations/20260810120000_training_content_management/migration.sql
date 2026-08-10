-- Additive fields for institutional course content management (materials + tasks).
-- Non-destructive: no drops, no data resets.

ALTER TABLE "training_materials"
  ADD COLUMN IF NOT EXISTS "duration_seconds" INTEGER,
  ADD COLUMN IF NOT EXISTS "available_from" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "file_id" UUID,
  ADD COLUMN IF NOT EXISTS "meta_json" JSONB;

CREATE INDEX IF NOT EXISTS "idx_training_materials_type"
  ON "training_materials" ("material_type");

CREATE INDEX IF NOT EXISTS "idx_training_materials_file"
  ON "training_materials" ("file_id");

ALTER TABLE "training_tasks"
  ADD COLUMN IF NOT EXISTS "settings_json" JSONB;
