-- Additive field-training completion-letter jobs + academic supervisor assignments.
-- Reversible: drop the new tables/columns/indexes created below.

ALTER TABLE "field_training_completion_letters"
  ADD COLUMN IF NOT EXISTS "source_data_hash" VARCHAR(64);

CREATE INDEX IF NOT EXISTS "idx_field_training_completion_letters_application"
  ON "field_training_completion_letters" ("application_id");

CREATE INDEX IF NOT EXISTS "idx_field_training_completion_letters_source_hash"
  ON "field_training_completion_letters" ("source_data_hash");

DO $$ BEGIN
  CREATE TYPE "field_training_completion_letter_job_status" AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "field_training_supervisor_import_status" AS ENUM ('previewed', 'applied', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "field_training_supervisor_audit_action" AS ENUM ('created', 'reassigned', 'unchanged');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "field_training_supervisor_import_batches" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "university_id" UUID NOT NULL,
  "opportunity_id" UUID NOT NULL,
  "original_filename" VARCHAR(500) NOT NULL,
  "file_hash" VARCHAR(64) NOT NULL,
  "file_size" INTEGER NOT NULL,
  "uploaded_by_id" UUID,
  "status" "field_training_supervisor_import_status" NOT NULL DEFAULT 'previewed',
  "preview_json" JSONB,
  "applied_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "field_training_supervisor_import_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "field_training_academic_supervisor_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "application_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "opportunity_id" UUID NOT NULL,
  "university_id" UUID NOT NULL,
  "supervisor_user_id" UUID NOT NULL,
  "import_batch_id" UUID,
  "assigned_by_id" UUID,
  "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "field_training_academic_supervisor_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "field_training_supervisor_name_mappings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "university_id" UUID NOT NULL,
  "normalized_name" VARCHAR(255) NOT NULL,
  "display_name" VARCHAR(255) NOT NULL,
  "supervisor_user_id" UUID NOT NULL,
  "supervisor_email" VARCHAR(255),
  "created_by_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "field_training_supervisor_name_mappings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "field_training_supervisor_import_audit" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "batch_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "opportunity_id" UUID NOT NULL,
  "university_id" UUID NOT NULL,
  "previous_supervisor_id" UUID,
  "new_supervisor_id" UUID NOT NULL,
  "action" "field_training_supervisor_audit_action" NOT NULL,
  "acting_admin_id" UUID,
  "original_filename" VARCHAR(500),
  "file_hash" VARCHAR(64),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "field_training_supervisor_import_audit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "field_training_completion_letter_jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "opportunity_id" UUID NOT NULL,
  "university_id" UUID,
  "status" "field_training_completion_letter_job_status" NOT NULL DEFAULT 'queued',
  "created_by_id" UUID,
  "retry_failed_only" BOOLEAN NOT NULL DEFAULT false,
  "payload" JSONB,
  "progress" JSONB,
  "error_message" TEXT,
  "started_at" TIMESTAMPTZ(6),
  "finished_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "field_training_completion_letter_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_ft_academic_supervisor_application"
  ON "field_training_academic_supervisor_assignments" ("application_id");

CREATE INDEX IF NOT EXISTS "idx_ft_academic_supervisor_user"
  ON "field_training_academic_supervisor_assignments" ("supervisor_user_id");

CREATE INDEX IF NOT EXISTS "idx_ft_academic_supervisor_opportunity"
  ON "field_training_academic_supervisor_assignments" ("opportunity_id");

CREATE INDEX IF NOT EXISTS "idx_ft_academic_supervisor_university"
  ON "field_training_academic_supervisor_assignments" ("university_id");

CREATE INDEX IF NOT EXISTS "idx_ft_academic_supervisor_student"
  ON "field_training_academic_supervisor_assignments" ("student_id");

CREATE INDEX IF NOT EXISTS "idx_ft_academic_supervisor_opp_user"
  ON "field_training_academic_supervisor_assignments" ("opportunity_id", "supervisor_user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_ft_supervisor_name_mappings"
  ON "field_training_supervisor_name_mappings" ("university_id", "normalized_name");

CREATE INDEX IF NOT EXISTS "idx_ft_supervisor_name_mappings_university"
  ON "field_training_supervisor_name_mappings" ("university_id");

CREATE INDEX IF NOT EXISTS "idx_ft_supervisor_name_mappings_user"
  ON "field_training_supervisor_name_mappings" ("supervisor_user_id");

CREATE INDEX IF NOT EXISTS "idx_ft_supervisor_import_batches_opportunity"
  ON "field_training_supervisor_import_batches" ("opportunity_id");

CREATE INDEX IF NOT EXISTS "idx_ft_supervisor_import_batches_university"
  ON "field_training_supervisor_import_batches" ("university_id");

CREATE INDEX IF NOT EXISTS "idx_ft_supervisor_import_batches_hash"
  ON "field_training_supervisor_import_batches" ("file_hash");

CREATE INDEX IF NOT EXISTS "idx_ft_supervisor_import_batches_uploader"
  ON "field_training_supervisor_import_batches" ("uploaded_by_id");

CREATE INDEX IF NOT EXISTS "idx_ft_supervisor_import_audit_batch"
  ON "field_training_supervisor_import_audit" ("batch_id");

CREATE INDEX IF NOT EXISTS "idx_ft_supervisor_import_audit_application"
  ON "field_training_supervisor_import_audit" ("application_id");

CREATE INDEX IF NOT EXISTS "idx_ft_supervisor_import_audit_student"
  ON "field_training_supervisor_import_audit" ("student_id");

CREATE INDEX IF NOT EXISTS "idx_ft_supervisor_import_audit_opportunity"
  ON "field_training_supervisor_import_audit" ("opportunity_id");

CREATE INDEX IF NOT EXISTS "idx_ft_completion_letter_jobs_opportunity"
  ON "field_training_completion_letter_jobs" ("opportunity_id");

CREATE INDEX IF NOT EXISTS "idx_ft_completion_letter_jobs_status"
  ON "field_training_completion_letter_jobs" ("status");

CREATE INDEX IF NOT EXISTS "idx_ft_completion_letter_jobs_opp_status"
  ON "field_training_completion_letter_jobs" ("opportunity_id", "status");

CREATE INDEX IF NOT EXISTS "idx_ft_completion_letter_jobs_creator"
  ON "field_training_completion_letter_jobs" ("created_by_id");

DO $$ BEGIN
  ALTER TABLE "field_training_supervisor_import_batches"
    ADD CONSTRAINT "field_training_supervisor_import_batches_university_id_fkey"
    FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "field_training_supervisor_import_batches"
    ADD CONSTRAINT "field_training_supervisor_import_batches_opportunity_id_fkey"
    FOREIGN KEY ("opportunity_id") REFERENCES "field_training_opportunities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "field_training_academic_supervisor_assignments"
    ADD CONSTRAINT "field_training_academic_supervisor_assignments_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "field_training_applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "field_training_academic_supervisor_assignments"
    ADD CONSTRAINT "field_training_academic_supervisor_assignments_opportunity_id_fkey"
    FOREIGN KEY ("opportunity_id") REFERENCES "field_training_opportunities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "field_training_academic_supervisor_assignments"
    ADD CONSTRAINT "field_training_academic_supervisor_assignments_university_id_fkey"
    FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "field_training_academic_supervisor_assignments"
    ADD CONSTRAINT "field_training_academic_supervisor_assignments_import_batch_id_fkey"
    FOREIGN KEY ("import_batch_id") REFERENCES "field_training_supervisor_import_batches"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "field_training_supervisor_name_mappings"
    ADD CONSTRAINT "field_training_supervisor_name_mappings_university_id_fkey"
    FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "field_training_supervisor_import_audit"
    ADD CONSTRAINT "field_training_supervisor_import_audit_batch_id_fkey"
    FOREIGN KEY ("batch_id") REFERENCES "field_training_supervisor_import_batches"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "field_training_completion_letter_jobs"
    ADD CONSTRAINT "field_training_completion_letter_jobs_opportunity_id_fkey"
    FOREIGN KEY ("opportunity_id") REFERENCES "field_training_opportunities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "field_training_completion_letter_jobs"
    ADD CONSTRAINT "field_training_completion_letter_jobs_university_id_fkey"
    FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
