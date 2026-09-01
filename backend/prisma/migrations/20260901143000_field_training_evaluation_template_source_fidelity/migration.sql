ALTER TABLE "field_training_final_evaluations"
  ADD COLUMN IF NOT EXISTS "source_template_file_id" UUID;

CREATE INDEX IF NOT EXISTS "idx_ft_final_eval_source_template_file"
  ON "field_training_final_evaluations" ("source_template_file_id");
