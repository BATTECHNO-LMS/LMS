ALTER TABLE "field_training_evaluation_policies"
  ADD COLUMN IF NOT EXISTS "scoring_rules" JSONB;
