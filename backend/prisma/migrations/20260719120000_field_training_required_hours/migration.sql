-- Add required training hours on field training opportunities (nullable for legacy rows).
ALTER TABLE "field_training_opportunities"
  ADD COLUMN IF NOT EXISTS "required_training_hours" INTEGER;

-- Optional check: when set, must be a positive integer.
ALTER TABLE "field_training_opportunities"
  DROP CONSTRAINT IF EXISTS "chk_ft_opportunities_required_training_hours_positive";

ALTER TABLE "field_training_opportunities"
  ADD CONSTRAINT "chk_ft_opportunities_required_training_hours_positive"
  CHECK ("required_training_hours" IS NULL OR "required_training_hours" > 0);

COMMENT ON COLUMN "field_training_opportunities"."required_training_hours" IS
  'Total training hours a student must complete for this opportunity; null = legacy / not enforced';
