-- Additive Field Training Phase 2: Logbook, Portfolio uploads, notification rule-state.
-- Does not alter scoring, eligibility, attendance, or historical results.

CREATE TYPE "field_training_logbook_status" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REVISION_REQUESTED'
);

CREATE TYPE "field_training_logbook_review_action" AS ENUM (
  'SUBMITTED',
  'REVISION_REQUESTED',
  'RESUBMITTED',
  'APPROVED'
);

CREATE TYPE "field_training_portfolio_source" AS ENUM (
  'TASK',
  'LOGBOOK',
  'RECORDED_LECTURE',
  'ASSESSMENT',
  'ATTENDANCE',
  'EVALUATION',
  'COMPLETION_LETTER',
  'CERTIFICATE',
  'STUDENT_UPLOAD'
);

CREATE TABLE "field_training_logbook_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "application_id" UUID NOT NULL,
  "opportunity_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "entry_date" DATE NOT NULL,
  "activity" TEXT NOT NULL,
  "learning_outcome" TEXT NOT NULL,
  "skills" TEXT,
  "challenges" TEXT,
  "outcome" TEXT,
  "reported_hours" DECIMAL(6, 2),
  "status" "field_training_logbook_status" NOT NULL DEFAULT 'DRAFT',
  "submitted_at" TIMESTAMPTZ(6),
  "reviewed_by_id" UUID,
  "reviewed_at" TIMESTAMPTZ(6),
  "revision_comment" TEXT,
  "deleted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "field_training_logbook_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "field_training_logbook_attachments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "entry_id" UUID NOT NULL,
  "file_id" UUID,
  "storage_key" VARCHAR(500) NOT NULL,
  "original_name" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(120),
  "size_bytes" INTEGER,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "field_training_logbook_attachments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "field_training_logbook_review_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "entry_id" UUID NOT NULL,
  "action" "field_training_logbook_review_action" NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "comment" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "field_training_logbook_review_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "field_training_portfolio_uploads" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "application_id" UUID NOT NULL,
  "opportunity_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "source" "field_training_portfolio_source" NOT NULL DEFAULT 'STUDENT_UPLOAD',
  "file_id" UUID,
  "storage_key" VARCHAR(500),
  "original_name" VARCHAR(255),
  "mime_type" VARCHAR(120),
  "size_bytes" INTEGER,
  "external_url" VARCHAR(2000),
  "deleted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "field_training_portfolio_uploads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "field_training_notification_rule_states" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "rule_code" VARCHAR(80) NOT NULL,
  "application_id" UUID NOT NULL,
  "entity_type" VARCHAR(80) NOT NULL DEFAULT 'application',
  "entity_id" UUID NOT NULL,
  "condition_key" VARCHAR(120) NOT NULL DEFAULT 'default',
  "last_condition_true" BOOLEAN NOT NULL DEFAULT false,
  "last_fired_at" TIMESTAMPTZ(6),
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "field_training_notification_rule_states_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "field_training_logbook_entries"
  ADD CONSTRAINT "field_training_logbook_entries_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "field_training_applications"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "field_training_logbook_entries"
  ADD CONSTRAINT "field_training_logbook_entries_opportunity_id_fkey"
  FOREIGN KEY ("opportunity_id") REFERENCES "field_training_opportunities"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "field_training_logbook_attachments"
  ADD CONSTRAINT "field_training_logbook_attachments_entry_id_fkey"
  FOREIGN KEY ("entry_id") REFERENCES "field_training_logbook_entries"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "field_training_logbook_review_events"
  ADD CONSTRAINT "field_training_logbook_review_events_entry_id_fkey"
  FOREIGN KEY ("entry_id") REFERENCES "field_training_logbook_entries"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "field_training_portfolio_uploads"
  ADD CONSTRAINT "field_training_portfolio_uploads_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "field_training_applications"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "field_training_notification_rule_states"
  ADD CONSTRAINT "field_training_notification_rule_states_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "field_training_applications"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE INDEX "idx_ft_logbook_application_status"
  ON "field_training_logbook_entries"("application_id", "status");

CREATE INDEX "idx_ft_logbook_opportunity_status"
  ON "field_training_logbook_entries"("opportunity_id", "status");

CREATE INDEX "idx_ft_logbook_student_date"
  ON "field_training_logbook_entries"("student_id", "entry_date");

CREATE INDEX "idx_ft_logbook_reviewed_by"
  ON "field_training_logbook_entries"("reviewed_by_id");

CREATE INDEX "idx_ft_logbook_entry_date"
  ON "field_training_logbook_entries"("entry_date");

CREATE INDEX "idx_ft_logbook_attachments_entry"
  ON "field_training_logbook_attachments"("entry_id");

CREATE INDEX "idx_ft_logbook_review_events_entry"
  ON "field_training_logbook_review_events"("entry_id", "created_at");

CREATE INDEX "idx_ft_portfolio_uploads_application"
  ON "field_training_portfolio_uploads"("application_id");

CREATE UNIQUE INDEX "uq_ft_notification_rule_state"
  ON "field_training_notification_rule_states"("rule_code", "application_id", "entity_type", "entity_id", "condition_key");

CREATE INDEX "idx_ft_notification_rule_state_app"
  ON "field_training_notification_rule_states"("application_id");
