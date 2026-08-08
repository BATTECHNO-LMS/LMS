-- Additive: institution training materials (shared training engine).
CREATE TABLE IF NOT EXISTS "training_materials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "program_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "cohort_id" UUID,
    "session_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "material_type" VARCHAR(40) NOT NULL DEFAULT 'LINK',
    "url" VARCHAR(2000),
    "storage_key" VARCHAR(500),
    "mime_type" VARCHAR(120),
    "visibility" VARCHAR(40) NOT NULL DEFAULT 'ENROLLED',
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_materials_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_training_materials_program" ON "training_materials"("program_id");
CREATE INDEX IF NOT EXISTS "idx_training_materials_org" ON "training_materials"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_training_materials_cohort" ON "training_materials"("cohort_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'training_materials_program_id_fkey'
  ) THEN
    ALTER TABLE "training_materials"
      ADD CONSTRAINT "training_materials_program_id_fkey"
      FOREIGN KEY ("program_id") REFERENCES "training_programs"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;
