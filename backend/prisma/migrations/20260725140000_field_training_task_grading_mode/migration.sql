-- Field training: grading modes, multi-file submissions, manual score fields

-- Grading mode enum (AI | MANUAL | NONE)
DO $$ BEGIN
  CREATE TYPE "field_training_task_grading_mode" AS ENUM ('AI', 'MANUAL', 'NONE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Extend review status with clearer submission lifecycle values (non-destructive)
DO $$ BEGIN
  ALTER TYPE "field_training_task_review_status" ADD VALUE IF NOT EXISTS 'submitted';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "field_training_task_review_status" ADD VALUE IF NOT EXISTS 'under_review';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "field_training_task_review_status" ADD VALUE IF NOT EXISTS 'graded';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Task grading mode (independent from is_final_task)
ALTER TABLE "field_training_tasks"
  ADD COLUMN IF NOT EXISTS "grading_mode" "field_training_task_grading_mode";

-- Backfill from existing AI flag: AI when self-eval required, otherwise MANUAL (prior non-AI upload+review flow)
UPDATE "field_training_tasks"
SET "grading_mode" = CASE
  WHEN "requires_ai_self_evaluation" = true THEN 'AI'::"field_training_task_grading_mode"
  ELSE 'MANUAL'::"field_training_task_grading_mode"
END
WHERE "grading_mode" IS NULL;

ALTER TABLE "field_training_tasks"
  ALTER COLUMN "grading_mode" SET DEFAULT 'AI'::"field_training_task_grading_mode";

ALTER TABLE "field_training_tasks"
  ALTER COLUMN "grading_mode" SET NOT NULL;

-- Manual grading fields on submissions
ALTER TABLE "field_training_task_submissions"
  ADD COLUMN IF NOT EXISTS "manual_score" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "solution_notes" TEXT,
  ADD COLUMN IF NOT EXISTS "max_score" DOUBLE PRECISION;

-- Multi-file submission attachments (legacy single file_* columns kept for backward compatibility)
CREATE TABLE IF NOT EXISTS "field_training_task_submission_files" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "submission_id" UUID NOT NULL,
  "file_id" UUID,
  "file_path" VARCHAR(500) NOT NULL,
  "file_name" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(120),
  "file_size" INTEGER,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "extraction_status" VARCHAR(40),
  "is_archive" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "fk_ft_submission_files_submission"
    FOREIGN KEY ("submission_id") REFERENCES "field_training_task_submissions"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_ft_submission_files_submission"
  ON "field_training_task_submission_files"("submission_id");

-- Migrate existing single-file submissions into the new files table
INSERT INTO "field_training_task_submission_files" (
  "submission_id", "file_id", "file_path", "file_name", "mime_type", "sort_order", "created_at"
)
SELECT
  s."id",
  s."analysis_file_id",
  s."file_path",
  COALESCE(s."file_name", 'file'),
  s."mime_type",
  0,
  COALESCE(s."submitted_at", NOW())
FROM "field_training_task_submissions" s
WHERE s."file_path" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "field_training_task_submission_files" f
    WHERE f."submission_id" = s."id" AND f."file_path" = s."file_path"
  );
