-- Additive: authoritative completed hours per field-training application (participant).
-- Write semantics: instructors replace the total via PATCH (not incremental add).
-- required_training_hours remains on field_training_opportunities (migration 28).

ALTER TABLE "field_training_applications"
ADD COLUMN "completed_training_hours" INTEGER,
ADD COLUMN "hours_updated_at" TIMESTAMPTZ(6),
ADD COLUMN "hours_updated_by_id" UUID;

ALTER TABLE "field_training_applications"
ADD CONSTRAINT "field_training_applications_completed_hours_nonneg"
CHECK ("completed_training_hours" IS NULL OR "completed_training_hours" >= 0);

CREATE INDEX "idx_field_training_applications_hours_updated"
ON "field_training_applications"("hours_updated_at");
