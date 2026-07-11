-- AI self-evaluation content sources: optional file, project URL, extraction audit

ALTER TABLE "field_training_task_submissions"
  ALTER COLUMN "file_path" DROP NOT NULL;

ALTER TABLE "field_training_task_submissions"
  ALTER COLUMN "file_name" DROP NOT NULL;

ALTER TABLE "field_training_task_submissions"
  ADD COLUMN IF NOT EXISTS "project_url" TEXT,
  ADD COLUMN IF NOT EXISTS "analysis_file_id" UUID,
  ADD COLUMN IF NOT EXISTS "file_extraction_status" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "file_extracted_text" TEXT,
  ADD COLUMN IF NOT EXISTS "url_extraction_status" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "url_extracted_text" TEXT,
  ADD COLUMN IF NOT EXISTS "extraction_errors" TEXT;
