-- Official branded training report registry (versioned, typed, verifiable).

CREATE TABLE IF NOT EXISTS "training_official_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "report_type" VARCHAR(40) NOT NULL,
    "program_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "cohort_id" UUID,
    "enrollment_id" UUID,
    "trainer_user_id" UUID,
    "scope_key" VARCHAR(255) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(40) NOT NULL DEFAULT 'READY',
    "snapshot_json" JSONB NOT NULL,
    "summary_text" TEXT,
    "reference_code" VARCHAR(80) NOT NULL,
    "verification_code" VARCHAR(64) NOT NULL,
    "is_latest" BOOLEAN NOT NULL DEFAULT true,
    "generated_by" UUID,
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_finalization_event_id" UUID,
    "pdf_path" VARCHAR(500),
    "excel_path" VARCHAR(500),
    "checksum" VARCHAR(128),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_official_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_training_official_reports_verification"
  ON "training_official_reports"("verification_code");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_training_official_reports_reference"
  ON "training_official_reports"("reference_code");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_training_official_reports_scope_version"
  ON "training_official_reports"("report_type", "scope_key", "version");

CREATE INDEX IF NOT EXISTS "idx_training_official_reports_org"
  ON "training_official_reports"("organization_id");

CREATE INDEX IF NOT EXISTS "idx_training_official_reports_program"
  ON "training_official_reports"("program_id");

CREATE INDEX IF NOT EXISTS "idx_training_official_reports_type"
  ON "training_official_reports"("report_type");

CREATE INDEX IF NOT EXISTS "idx_training_official_reports_enrollment"
  ON "training_official_reports"("enrollment_id");

CREATE INDEX IF NOT EXISTS "idx_training_official_reports_latest"
  ON "training_official_reports"("program_id", "report_type", "is_latest");

ALTER TABLE "training_official_reports"
  ADD CONSTRAINT "training_official_reports_program_fkey"
  FOREIGN KEY ("program_id") REFERENCES "training_programs"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
