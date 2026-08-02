-- Additive: stable codes + program settings for institutional course seeds.
ALTER TABLE "training_programs"
  ADD COLUMN IF NOT EXISTS "code" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "settings_json" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_training_programs_code"
  ON "training_programs"("code")
  WHERE "code" IS NOT NULL;

ALTER TABLE "training_cohorts"
  ADD COLUMN IF NOT EXISTS "code" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "delivery_mode" VARCHAR(40);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_training_cohorts_code"
  ON "training_cohorts"("code")
  WHERE "code" IS NOT NULL;

ALTER TABLE "training_assessments"
  ADD COLUMN IF NOT EXISTS "code" VARCHAR(80);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_training_assessments_code"
  ON "training_assessments"("code")
  WHERE "code" IS NOT NULL;
