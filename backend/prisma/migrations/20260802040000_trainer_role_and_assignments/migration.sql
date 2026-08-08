-- Additive: institution trainer role + course-scoped trainer assignments.

INSERT INTO "roles" ("id", "name", "code", "scope", "description", "created_at", "updated_at")
SELECT gen_random_uuid(), 'Trainer', 'trainer', 'university',
       'Institution training-course trainer (not university field-training instructor).',
       NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "roles" WHERE "code" = 'trainer');

CREATE TABLE IF NOT EXISTS "training_trainer_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "trainer_user_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "training_program_id" UUID NOT NULL,
  "training_cohort_id" UUID,
  "is_lead_trainer" BOOLEAN NOT NULL DEFAULT false,
  "can_manage_sessions" BOOLEAN NOT NULL DEFAULT true,
  "can_manage_attendance" BOOLEAN NOT NULL DEFAULT true,
  "can_manage_materials" BOOLEAN NOT NULL DEFAULT true,
  "can_manage_tasks" BOOLEAN NOT NULL DEFAULT true,
  "can_grade_tasks" BOOLEAN NOT NULL DEFAULT true,
  "can_manage_assessments" BOOLEAN NOT NULL DEFAULT true,
  "can_grade_assessments" BOOLEAN NOT NULL DEFAULT true,
  "can_view_trainees" BOOLEAN NOT NULL DEFAULT true,
  "can_view_progress" BOOLEAN NOT NULL DEFAULT true,
  "can_view_reports" BOOLEAN NOT NULL DEFAULT true,
  "can_send_course_announcements" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "assigned_by" UUID,
  "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "revoked_at" TIMESTAMPTZ(6),
  CONSTRAINT "training_trainer_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "trainer_profiles" (
  "user_id" UUID NOT NULL,
  "professional_bio" TEXT,
  "training_field" VARCHAR(255),
  "specialty" VARCHAR(255),
  "cv_url" VARCHAR(1000),
  "avatar_url" VARCHAR(1000),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "trainer_profiles_pkey" PRIMARY KEY ("user_id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'training_trainer_assignments_organization_id_fkey'
  ) THEN
    ALTER TABLE "training_trainer_assignments"
      ADD CONSTRAINT "training_trainer_assignments_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'training_trainer_assignments_program_id_fkey'
  ) THEN
    ALTER TABLE "training_trainer_assignments"
      ADD CONSTRAINT "training_trainer_assignments_program_id_fkey"
      FOREIGN KEY ("training_program_id") REFERENCES "training_programs"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'training_trainer_assignments_cohort_id_fkey'
  ) THEN
    ALTER TABLE "training_trainer_assignments"
      ADD CONSTRAINT "training_trainer_assignments_cohort_id_fkey"
      FOREIGN KEY ("training_cohort_id") REFERENCES "training_cohorts"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trainer_profiles_user_id_fkey'
  ) THEN
    ALTER TABLE "trainer_profiles"
      ADD CONSTRAINT "trainer_profiles_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_tta_trainer_active"
  ON "training_trainer_assignments"("trainer_user_id", "is_active");
CREATE INDEX IF NOT EXISTS "idx_tta_org_active"
  ON "training_trainer_assignments"("organization_id", "is_active");
CREATE INDEX IF NOT EXISTS "idx_tta_program_active"
  ON "training_trainer_assignments"("training_program_id", "is_active");
CREATE INDEX IF NOT EXISTS "idx_tta_cohort_active"
  ON "training_trainer_assignments"("training_cohort_id", "is_active");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_tta_trainer_program_cohort"
  ON "training_trainer_assignments"("trainer_user_id", "training_program_id", "training_cohort_id")
  WHERE "training_cohort_id" IS NOT NULL AND "revoked_at" IS NULL AND "is_active" = true;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_tta_trainer_program_level"
  ON "training_trainer_assignments"("trainer_user_id", "training_program_id")
  WHERE "training_cohort_id" IS NULL AND "revoked_at" IS NULL AND "is_active" = true;
