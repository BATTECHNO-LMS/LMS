-- Additive: multi-file attachments for course (training program) task submissions.
-- Legacy single-file submissions keep using training_task_submissions.content_url.

CREATE TABLE "training_task_submission_files" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "submission_id" UUID NOT NULL,
  "file_id" UUID,
  "storage_key" VARCHAR(1024) NOT NULL,
  "original_name" VARCHAR(500) NOT NULL,
  "mime_type" VARCHAR(255),
  "size" BIGINT NOT NULL DEFAULT 0,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_archive" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "training_task_submission_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_training_task_submission_files_submission"
  ON "training_task_submission_files"("submission_id");

CREATE INDEX "idx_training_task_submission_files_file"
  ON "training_task_submission_files"("file_id");

ALTER TABLE "training_task_submission_files"
  ADD CONSTRAINT "training_task_submission_files_submission_id_fkey"
  FOREIGN KEY ("submission_id") REFERENCES "training_task_submissions"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
