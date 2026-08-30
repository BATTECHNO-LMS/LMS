-- Additive: store academic supervisor as enrollment plain text. No account required.

ALTER TABLE "field_training_applications"
  ADD COLUMN IF NOT EXISTS "academic_supervisor_name" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "academic_supervisor_normalized" VARCHAR(255);

CREATE INDEX IF NOT EXISTS "idx_ft_applications_supervisor_normalized"
  ON "field_training_applications" ("opportunity_id", "academic_supervisor_normalized");

ALTER TABLE "field_training_academic_supervisor_assignments"
  ADD COLUMN IF NOT EXISTS "academic_supervisor_name" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "academic_supervisor_normalized" VARCHAR(255);

ALTER TABLE "field_training_academic_supervisor_assignments"
  ALTER COLUMN "supervisor_user_id" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_ft_academic_supervisor_name"
  ON "field_training_academic_supervisor_assignments" ("opportunity_id", "academic_supervisor_normalized");

ALTER TABLE "field_training_supervisor_import_audit"
  ADD COLUMN IF NOT EXISTS "previous_supervisor_name" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "new_supervisor_name" VARCHAR(255);

ALTER TABLE "field_training_supervisor_import_audit"
  ALTER COLUMN "new_supervisor_id" DROP NOT NULL;
