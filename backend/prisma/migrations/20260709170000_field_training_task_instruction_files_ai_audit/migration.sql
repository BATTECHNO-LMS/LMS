-- Task instruction files (admin/instructor upload) + AI evaluation timestamp on submissions
ALTER TABLE "field_training_tasks"
  ADD COLUMN IF NOT EXISTS "instruction_file_path" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "instruction_file_name" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "instruction_file_mime_type" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "instruction_file_size" INTEGER,
  ADD COLUMN IF NOT EXISTS "instruction_file_uploaded_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "instruction_file_uploaded_by_id" UUID;

ALTER TABLE "field_training_task_submissions"
  ADD COLUMN IF NOT EXISTS "ai_evaluated_at" TIMESTAMPTZ(6);
