-- Additive Field Training official evaluation templates, policies, supervisor
-- ratings, and persisted final evaluation snapshots. Does not drop or rewrite
-- existing field-training or certificate tables.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "university_student_number" VARCHAR(80);

CREATE INDEX IF NOT EXISTS "idx_users_university_student_number"
  ON "users" ("university_student_number");

CREATE INDEX IF NOT EXISTS "idx_users_university_student_number_scope"
  ON "users" ("primary_university_id", "university_student_number");

CREATE TYPE "field_training_eval_final_status" AS ENUM (
  'PASSED',
  'FAILED',
  'NOT_ELIGIBLE'
);

CREATE TYPE "field_training_eval_template_validation" AS ENUM (
  'pending',
  'valid',
  'invalid'
);

ALTER TABLE "field_training_opportunities"
  ADD COLUMN IF NOT EXISTS "host_organization" JSONB,
  ADD COLUMN IF NOT EXISTS "evaluation_template_id" UUID;

CREATE TABLE "field_training_evaluation_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "university_id" UUID NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "original_file_id" UUID NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "validation_status" "field_training_eval_template_validation" NOT NULL DEFAULT 'pending',
  "validation_json" JSONB,
  "created_by_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archived_at" TIMESTAMPTZ(6),

  CONSTRAINT "field_training_evaluation_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "field_training_evaluation_policies" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "university_id" UUID NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "minimum_attendance_percentage" DECIMAL(5, 2) NOT NULL DEFAULT 80,
  "required_training_hours" INTEGER,
  "required_tasks_required" BOOLEAN NOT NULL DEFAULT true,
  "post_assessment_required" BOOLEAN NOT NULL DEFAULT true,
  "professional_evaluation_required" BOOLEAN NOT NULL DEFAULT true,
  "minimum_passing_score" DECIMAL(5, 2) NOT NULL DEFAULT 60,
  "attendance_weight" DECIMAL(5, 2) NOT NULL DEFAULT 20,
  "tasks_weight" DECIMAL(5, 2) NOT NULL DEFAULT 20,
  "post_assessment_weight" DECIMAL(5, 2) NOT NULL DEFAULT 20,
  "professional_evaluation_weight" DECIMAL(5, 2) NOT NULL DEFAULT 40,
  "attendance_bands" JSONB,
  "created_by_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archived_at" TIMESTAMPTZ(6),

  CONSTRAINT "field_training_evaluation_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "field_training_supervisor_ratings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "university_id" UUID NOT NULL,
  "opportunity_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "thinking_and_initiative" INTEGER NOT NULL,
  "problem_solving" INTEGER NOT NULL,
  "teamwork" INTEGER NOT NULL,
  "professional_conduct" INTEGER NOT NULL,
  "supervisor_cooperation" INTEGER NOT NULL,
  "rules_compliance" INTEGER NOT NULL,
  "notes" TEXT,
  "rated_by_id" UUID,
  "rated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "field_training_supervisor_ratings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "field_training_final_evaluations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "university_id" UUID NOT NULL,
  "opportunity_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "template_id" UUID,
  "template_version" INTEGER,
  "policy_id" UUID,
  "policy_version" INTEGER,
  "eligibility_status" VARCHAR(32) NOT NULL,
  "final_status" "field_training_eval_final_status" NOT NULL,
  "eligibility_reasons" JSONB NOT NULL,
  "attendance_component_score" DECIMAL(6, 2),
  "tasks_component_score" DECIMAL(6, 2),
  "post_assessment_component_score" DECIMAL(6, 2),
  "professional_component_score" DECIMAL(6, 2),
  "pre_assessment_score" DECIMAL(6, 2),
  "post_assessment_score" DECIMAL(6, 2),
  "improvement_percentage" DECIMAL(6, 2),
  "criterion_1_score" INTEGER,
  "criterion_2_score" INTEGER,
  "criterion_3_score" INTEGER,
  "criterion_4_score" INTEGER,
  "criterion_5_score" INTEGER,
  "criterion_6_score" INTEGER,
  "criterion_7_score" INTEGER,
  "criterion_8_score" INTEGER,
  "criterion_9_score" INTEGER,
  "criterion_10_score" INTEGER,
  "professional_total" INTEGER,
  "professional_percentage" DECIMAL(6, 2),
  "final_score" DECIMAL(6, 2),
  "final_percentage" DECIMAL(6, 2),
  "auto_comment" TEXT,
  "general_comments" TEXT,
  "comments_edited_by_id" UUID,
  "comments_edited_at" TIMESTAMPTZ(6),
  "score_evidence_json" JSONB,
  "pdf_file_id" UUID,
  "filled_docx_file_id" UUID,
  "is_current" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "supersedes_evaluation_id" UUID,
  "regeneration_reason" TEXT,
  "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "generated_by_id" UUID,
  "finalized_at" TIMESTAMPTZ(6),
  "finalized_by_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "field_training_final_evaluations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "field_training_evaluation_templates"
  ADD CONSTRAINT "field_training_evaluation_templates_university_id_fkey"
  FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "field_training_evaluation_policies"
  ADD CONSTRAINT "field_training_evaluation_policies_university_id_fkey"
  FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "field_training_supervisor_ratings"
  ADD CONSTRAINT "field_training_supervisor_ratings_opportunity_id_fkey"
  FOREIGN KEY ("opportunity_id") REFERENCES "field_training_opportunities"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  ADD CONSTRAINT "field_training_supervisor_ratings_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "field_training_applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  ADD CONSTRAINT "field_training_supervisor_ratings_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "field_training_final_evaluations"
  ADD CONSTRAINT "field_training_final_evaluations_university_id_fkey"
  FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  ADD CONSTRAINT "field_training_final_evaluations_opportunity_id_fkey"
  FOREIGN KEY ("opportunity_id") REFERENCES "field_training_opportunities"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  ADD CONSTRAINT "field_training_final_evaluations_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "field_training_applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  ADD CONSTRAINT "field_training_final_evaluations_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  ADD CONSTRAINT "field_training_final_evaluations_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "field_training_evaluation_templates"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  ADD CONSTRAINT "field_training_final_evaluations_policy_id_fkey"
  FOREIGN KEY ("policy_id") REFERENCES "field_training_evaluation_policies"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "field_training_opportunities"
  ADD CONSTRAINT "field_training_opportunities_evaluation_template_id_fkey"
  FOREIGN KEY ("evaluation_template_id") REFERENCES "field_training_evaluation_templates"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE INDEX "idx_field_training_opportunities_eval_template"
  ON "field_training_opportunities" ("evaluation_template_id");

CREATE INDEX "idx_ft_eval_templates_university"
  ON "field_training_evaluation_templates" ("university_id");
CREATE INDEX "idx_ft_eval_templates_default"
  ON "field_training_evaluation_templates" ("university_id", "is_default", "is_active");
CREATE INDEX "idx_ft_eval_templates_file"
  ON "field_training_evaluation_templates" ("original_file_id");
CREATE INDEX "idx_ft_eval_templates_archived"
  ON "field_training_evaluation_templates" ("archived_at");

CREATE UNIQUE INDEX "uq_ft_eval_templates_university_default"
  ON "field_training_evaluation_templates" ("university_id")
  WHERE "is_default" = true AND "is_active" = true AND "archived_at" IS NULL;

CREATE INDEX "idx_ft_eval_policies_university"
  ON "field_training_evaluation_policies" ("university_id");
CREATE INDEX "idx_ft_eval_policies_active"
  ON "field_training_evaluation_policies" ("university_id", "is_active");

CREATE UNIQUE INDEX "uq_ft_eval_policies_university_active"
  ON "field_training_evaluation_policies" ("university_id")
  WHERE "is_active" = true AND "archived_at" IS NULL;

CREATE INDEX "idx_ft_supervisor_ratings_application"
  ON "field_training_supervisor_ratings" ("application_id");
CREATE INDEX "idx_ft_supervisor_ratings_opportunity"
  ON "field_training_supervisor_ratings" ("opportunity_id");
CREATE INDEX "idx_ft_supervisor_ratings_student"
  ON "field_training_supervisor_ratings" ("student_id");
CREATE INDEX "idx_ft_supervisor_ratings_university"
  ON "field_training_supervisor_ratings" ("university_id");
CREATE INDEX "idx_ft_supervisor_ratings_rated_at"
  ON "field_training_supervisor_ratings" ("rated_at");

CREATE INDEX "idx_ft_final_eval_university"
  ON "field_training_final_evaluations" ("university_id");
CREATE INDEX "idx_ft_final_eval_opportunity"
  ON "field_training_final_evaluations" ("opportunity_id");
CREATE INDEX "idx_ft_final_eval_application"
  ON "field_training_final_evaluations" ("application_id");
CREATE INDEX "idx_ft_final_eval_student"
  ON "field_training_final_evaluations" ("student_id");
CREATE INDEX "idx_ft_final_eval_status"
  ON "field_training_final_evaluations" ("final_status");
CREATE INDEX "idx_ft_final_eval_current"
  ON "field_training_final_evaluations" ("is_current");
CREATE INDEX "idx_ft_final_eval_generated"
  ON "field_training_final_evaluations" ("generated_at");
CREATE INDEX "idx_ft_final_eval_uni_opp_current"
  ON "field_training_final_evaluations" ("university_id", "opportunity_id", "is_current");
CREATE INDEX "idx_ft_final_eval_pdf"
  ON "field_training_final_evaluations" ("pdf_file_id");

CREATE UNIQUE INDEX "uq_ft_final_eval_current_application"
  ON "field_training_final_evaluations" ("application_id")
  WHERE "is_current" = true;
