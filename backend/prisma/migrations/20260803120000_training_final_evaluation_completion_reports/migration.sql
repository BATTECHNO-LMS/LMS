-- Institutional final evaluation, completion finalization snapshots, and reports.

CREATE TYPE "training_evaluation_assignment_status" AS ENUM (
  'LOCKED',
  'AVAILABLE',
  'IN_PROGRESS',
  'SUBMITTED',
  'REOPENED',
  'CLOSED'
);

CREATE TYPE "training_evaluation_question_type" AS ENUM (
  'RATING_SCALE',
  'NPS',
  'OPEN_TEXT'
);

CREATE TYPE "training_evaluation_section_code" AS ENUM (
  'TRAINER',
  'CONTENT',
  'ACTIVITIES',
  'VENUE_ORG',
  'IMPACT',
  'NPS_FEEDBACK'
);

ALTER TABLE "training_trainer_assignments"
  ADD COLUMN IF NOT EXISTS "can_finalize_training" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "training_evaluation_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID,
  "code" VARCHAR(80),
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "delivery_mode" VARCHAR(40),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "training_evaluation_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_training_evaluation_templates_code" ON "training_evaluation_templates"("code");
CREATE INDEX "idx_training_evaluation_templates_org" ON "training_evaluation_templates"("organization_id");

CREATE TABLE "training_evaluation_sections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "template_id" UUID NOT NULL,
  "code" "training_evaluation_section_code" NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "indicator_key" VARCHAR(80),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "training_evaluation_sections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_training_evaluation_sections_template_code" ON "training_evaluation_sections"("template_id", "code");
CREATE INDEX "idx_training_evaluation_sections_template" ON "training_evaluation_sections"("template_id");

CREATE TABLE "training_evaluation_questions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "section_id" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "prompt" TEXT NOT NULL,
  "question_type" "training_evaluation_question_type" NOT NULL,
  "is_required" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "scale_min" INTEGER,
  "scale_max" INTEGER,
  "scale_labels_json" JSONB,
  "delivery_modes_json" JSONB,
  "max_length" INTEGER,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "training_evaluation_questions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_training_evaluation_questions_section_code" ON "training_evaluation_questions"("section_id", "code");
CREATE INDEX "idx_training_evaluation_questions_section" ON "training_evaluation_questions"("section_id");

CREATE TABLE "training_program_evaluation_links" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "program_id" UUID NOT NULL,
  "template_id" UUID NOT NULL,
  "is_required" BOOLEAN NOT NULL DEFAULT true,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "training_program_evaluation_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_training_program_evaluation_links_program" ON "training_program_evaluation_links"("program_id");
CREATE INDEX "idx_training_program_evaluation_links_template" ON "training_program_evaluation_links"("template_id");

CREATE TABLE "training_evaluation_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "program_id" UUID NOT NULL,
  "enrollment_id" UUID NOT NULL,
  "template_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "status" "training_evaluation_assignment_status" NOT NULL DEFAULT 'LOCKED',
  "available_at" TIMESTAMPTZ(6),
  "started_at" TIMESTAMPTZ(6),
  "submitted_at" TIMESTAMPTZ(6),
  "reopened_at" TIMESTAMPTZ(6),
  "reopen_reason" TEXT,
  "reopened_by" UUID,
  "delivery_mode_effective" VARCHAR(40),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "training_evaluation_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_training_evaluation_assignments_enrollment" ON "training_evaluation_assignments"("enrollment_id");
CREATE INDEX "idx_training_evaluation_assignments_program" ON "training_evaluation_assignments"("program_id");
CREATE INDEX "idx_training_evaluation_assignments_user" ON "training_evaluation_assignments"("user_id");
CREATE INDEX "idx_training_evaluation_assignments_status" ON "training_evaluation_assignments"("status");

CREATE TABLE "training_evaluation_responses" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "assignment_id" UUID NOT NULL,
  "enrollment_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
  "answers_json" JSONB,
  "scores_json" JSONB,
  "nps_score" INTEGER,
  "nps_category" VARCHAR(20),
  "overall_reaction_score" DECIMAL(8,2),
  "submitted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "training_evaluation_responses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_training_evaluation_responses_assignment" ON "training_evaluation_responses"("assignment_id");
CREATE INDEX "idx_training_evaluation_responses_enrollment" ON "training_evaluation_responses"("enrollment_id");

CREATE TABLE "training_evaluation_answers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "response_id" UUID NOT NULL,
  "question_id" UUID NOT NULL,
  "numeric_value" DECIMAL(8,2),
  "text_value" TEXT,
  "nps_category" VARCHAR(20),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "training_evaluation_answers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_training_evaluation_answers_response_question" ON "training_evaluation_answers"("response_id", "question_id");
CREATE INDEX "idx_training_evaluation_answers_response" ON "training_evaluation_answers"("response_id");

CREATE TABLE "training_individual_reports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "enrollment_id" UUID NOT NULL,
  "program_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" VARCHAR(40) NOT NULL DEFAULT 'GENERATED',
  "snapshot_json" JSONB NOT NULL,
  "summary_text" TEXT,
  "generated_by" UUID,
  "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "training_individual_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_training_individual_reports_enrollment_version" ON "training_individual_reports"("enrollment_id", "version");
CREATE INDEX "idx_training_individual_reports_program" ON "training_individual_reports"("program_id");

CREATE TABLE "training_course_reports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "program_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "cohort_id" UUID,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" VARCHAR(40) NOT NULL DEFAULT 'GENERATED',
  "snapshot_json" JSONB NOT NULL,
  "generated_by" UUID,
  "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finalization_mode" VARCHAR(40),
  "finalization_reason" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "training_course_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_training_course_reports_program_cohort_version" ON "training_course_reports"("program_id", "cohort_id", "version");
CREATE INDEX "idx_training_course_reports_org" ON "training_course_reports"("organization_id");

CREATE TABLE "training_finalization_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "program_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "cohort_id" UUID,
  "mode" VARCHAR(40) NOT NULL,
  "reason" TEXT,
  "acted_by" UUID NOT NULL,
  "eligible_count" INTEGER NOT NULL DEFAULT 0,
  "completed_count" INTEGER NOT NULL DEFAULT 0,
  "exceptional_count" INTEGER NOT NULL DEFAULT 0,
  "enrollment_ids_json" JSONB,
  "result_json" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "training_finalization_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_training_finalization_events_program" ON "training_finalization_events"("program_id");

ALTER TABLE "training_evaluation_sections"
  ADD CONSTRAINT "training_evaluation_sections_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "training_evaluation_templates"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "training_evaluation_questions"
  ADD CONSTRAINT "training_evaluation_questions_section_id_fkey"
  FOREIGN KEY ("section_id") REFERENCES "training_evaluation_sections"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "training_program_evaluation_links"
  ADD CONSTRAINT "training_program_evaluation_links_program_id_fkey"
  FOREIGN KEY ("program_id") REFERENCES "training_programs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "training_program_evaluation_links"
  ADD CONSTRAINT "training_program_evaluation_links_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "training_evaluation_templates"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "training_evaluation_assignments"
  ADD CONSTRAINT "training_evaluation_assignments_program_id_fkey"
  FOREIGN KEY ("program_id") REFERENCES "training_programs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "training_evaluation_assignments"
  ADD CONSTRAINT "training_evaluation_assignments_enrollment_id_fkey"
  FOREIGN KEY ("enrollment_id") REFERENCES "training_enrollments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "training_evaluation_assignments"
  ADD CONSTRAINT "training_evaluation_assignments_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "training_evaluation_templates"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "training_evaluation_responses"
  ADD CONSTRAINT "training_evaluation_responses_assignment_id_fkey"
  FOREIGN KEY ("assignment_id") REFERENCES "training_evaluation_assignments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "training_evaluation_responses"
  ADD CONSTRAINT "training_evaluation_responses_enrollment_id_fkey"
  FOREIGN KEY ("enrollment_id") REFERENCES "training_enrollments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "training_evaluation_answers"
  ADD CONSTRAINT "training_evaluation_answers_response_id_fkey"
  FOREIGN KEY ("response_id") REFERENCES "training_evaluation_responses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "training_evaluation_answers"
  ADD CONSTRAINT "training_evaluation_answers_question_id_fkey"
  FOREIGN KEY ("question_id") REFERENCES "training_evaluation_questions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "training_individual_reports"
  ADD CONSTRAINT "training_individual_reports_enrollment_id_fkey"
  FOREIGN KEY ("enrollment_id") REFERENCES "training_enrollments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "training_individual_reports"
  ADD CONSTRAINT "training_individual_reports_program_id_fkey"
  FOREIGN KEY ("program_id") REFERENCES "training_programs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "training_course_reports"
  ADD CONSTRAINT "training_course_reports_program_id_fkey"
  FOREIGN KEY ("program_id") REFERENCES "training_programs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
