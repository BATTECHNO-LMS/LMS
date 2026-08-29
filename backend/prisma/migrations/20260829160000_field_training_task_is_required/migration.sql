-- Field training tasks: required vs optional (default required for existing rows)

ALTER TABLE "field_training_tasks"
  ADD COLUMN IF NOT EXISTS "is_required" BOOLEAN NOT NULL DEFAULT true;
