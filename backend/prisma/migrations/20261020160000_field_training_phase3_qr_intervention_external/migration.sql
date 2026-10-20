-- Additive Field Training Phase 3: QR challenges, intervention cases, external supervisor assignments.
-- Does not alter scoring or recorded-lecture attendance semantics.

ALTER TYPE "field_training_attendance_method" ADD VALUE IF NOT EXISTS 'qr';

CREATE TABLE "field_training_attendance_qr_challenges" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "window_id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "challenge_hash" VARCHAR(128) NOT NULL,
  "rotation_version" INTEGER NOT NULL DEFAULT 1,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "field_training_attendance_qr_challenges_pkey" PRIMARY KEY ("id")
);

CREATE TYPE "field_training_intervention_case_type" AS ENUM (
  'LOW_ATTENDANCE',
  'TASKS_OVERDUE',
  'LOW_PERFORMANCE',
  'MISSING_POST',
  'HOURS_INCOMPLETE',
  'INACTIVITY',
  'BEHAVIOR_CONCERN',
  'SUPERVISOR_CONCERN',
  'STUDENT_SUPPORT',
  'OTHER'
);

CREATE TYPE "field_training_intervention_severity" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
);

CREATE TYPE "field_training_intervention_status" AS ENUM (
  'OPEN',
  'IN_PROGRESS',
  'MONITORING',
  'RESOLVED',
  'CLOSED'
);

CREATE TYPE "field_training_intervention_source" AS ENUM (
  'MANUAL',
  'RISK_ENGINE_SUGGESTED'
);

CREATE TYPE "field_training_intervention_action" AS ENUM (
  'CASE_OPENED',
  'ASSIGNED',
  'COMMENT_ADDED',
  'STUDENT_CONTACTED',
  'SUPERVISOR_CONTACTED',
  'WARNING_SENT',
  'MEETING_HELD',
  'ACTION_PLAN_CREATED',
  'STATUS_CHANGED',
  'FOLLOW_UP_ADDED',
  'RESOLVED',
  'REOPENED'
);

CREATE TYPE "field_training_intervention_resolution" AS ENUM (
  'IMPROVED',
  'REQUIREMENT_COMPLETED',
  'WARNING_ISSUED',
  'REFERRED',
  'NO_FURTHER_ACTION',
  'TRAINING_ENDED',
  'OTHER'
);

CREATE TABLE "field_training_intervention_cases" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "application_id" UUID NOT NULL,
  "opportunity_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "case_type" "field_training_intervention_case_type" NOT NULL,
  "severity" "field_training_intervention_severity" NOT NULL DEFAULT 'MEDIUM',
  "status" "field_training_intervention_status" NOT NULL DEFAULT 'OPEN',
  "source" "field_training_intervention_source" NOT NULL DEFAULT 'MANUAL',
  "title" VARCHAR(255) NOT NULL,
  "reason" TEXT,
  "description" TEXT,
  "opened_by_id" UUID NOT NULL,
  "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assigned_to_id" UUID,
  "due_at" TIMESTAMPTZ(6),
  "follow_up_at" TIMESTAMPTZ(6),
  "resolved_at" TIMESTAMPTZ(6),
  "resolved_by_id" UUID,
  "resolution" "field_training_intervention_resolution",
  "resolution_note" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "field_training_intervention_cases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "field_training_intervention_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "case_id" UUID NOT NULL,
  "action" "field_training_intervention_action" NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "note" TEXT,
  "student_visible" BOOLEAN NOT NULL DEFAULT false,
  "next_step" TEXT,
  "follow_up_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "field_training_intervention_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "field_training_external_supervisor_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "supervisor_user_id" UUID NOT NULL,
  "opportunity_id" UUID NOT NULL,
  "application_id" UUID,
  "organization_label" VARCHAR(255),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "assigned_by_id" UUID,
  "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "field_training_external_supervisor_assignments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "field_training_attendance_qr_challenges"
  ADD CONSTRAINT "ft_qr_challenges_window_id_fkey"
  FOREIGN KEY ("window_id") REFERENCES "field_training_attendance_windows"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "field_training_attendance_qr_challenges"
  ADD CONSTRAINT "ft_qr_challenges_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "field_training_sessions"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "field_training_intervention_cases"
  ADD CONSTRAINT "ft_intervention_cases_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "field_training_applications"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "field_training_intervention_cases"
  ADD CONSTRAINT "ft_intervention_cases_opportunity_id_fkey"
  FOREIGN KEY ("opportunity_id") REFERENCES "field_training_opportunities"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "field_training_intervention_events"
  ADD CONSTRAINT "ft_intervention_events_case_id_fkey"
  FOREIGN KEY ("case_id") REFERENCES "field_training_intervention_cases"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "field_training_external_supervisor_assignments"
  ADD CONSTRAINT "ft_ext_sup_assign_opportunity_id_fkey"
  FOREIGN KEY ("opportunity_id") REFERENCES "field_training_opportunities"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "field_training_external_supervisor_assignments"
  ADD CONSTRAINT "ft_ext_sup_assign_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "field_training_applications"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE INDEX "idx_ft_qr_challenges_window_exp"
  ON "field_training_attendance_qr_challenges"("window_id", "expires_at");

CREATE INDEX "idx_ft_qr_challenges_session"
  ON "field_training_attendance_qr_challenges"("session_id");

CREATE INDEX "idx_ft_intervention_cases_opp_status"
  ON "field_training_intervention_cases"("opportunity_id", "status");

CREATE INDEX "idx_ft_intervention_cases_app_type_status"
  ON "field_training_intervention_cases"("application_id", "case_type", "status");

CREATE INDEX "idx_ft_intervention_cases_assigned"
  ON "field_training_intervention_cases"("assigned_to_id", "status");

CREATE INDEX "idx_ft_intervention_cases_follow_up"
  ON "field_training_intervention_cases"("follow_up_at");

CREATE INDEX "idx_ft_intervention_events_case"
  ON "field_training_intervention_events"("case_id", "created_at");

CREATE UNIQUE INDEX "uq_ft_ext_sup_active_app"
  ON "field_training_external_supervisor_assignments"("supervisor_user_id", "application_id")
  WHERE "application_id" IS NOT NULL AND "is_active" = true;

CREATE INDEX "idx_ft_ext_sup_supervisor"
  ON "field_training_external_supervisor_assignments"("supervisor_user_id", "is_active");

CREATE INDEX "idx_ft_ext_sup_opportunity"
  ON "field_training_external_supervisor_assignments"("opportunity_id", "is_active");
