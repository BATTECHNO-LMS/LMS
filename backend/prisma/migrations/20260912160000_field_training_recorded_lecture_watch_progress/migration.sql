-- Additive Field Training recorded lecture watch progress and segments.
-- Does not alter scoring, attendance, assessments, applications, or historical results.

CREATE TABLE "field_training_recorded_lecture_progress" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "lecture_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "video_duration_seconds" INTEGER,
  "unique_watched_seconds" INTEGER NOT NULL DEFAULT 0,
  "total_playback_seconds" INTEGER NOT NULL DEFAULT 0,
  "last_position_seconds" INTEGER NOT NULL DEFAULT 0,
  "progress_percentage" DECIMAL(5, 2),
  "started_at" TIMESTAMPTZ(6),
  "last_watched_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "heartbeat_cursors" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "field_training_recorded_lecture_progress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "field_training_recorded_lecture_watch_segments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "progress_id" UUID NOT NULL,
  "start_second" INTEGER NOT NULL,
  "end_second" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "field_training_recorded_lecture_watch_segments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "field_training_recorded_lecture_progress"
  ADD CONSTRAINT "field_training_recorded_lecture_progress_lecture_id_fkey"
  FOREIGN KEY ("lecture_id") REFERENCES "field_training_recorded_lectures"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "field_training_recorded_lecture_progress"
  ADD CONSTRAINT "field_training_recorded_lecture_progress_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "field_training_applications"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "field_training_recorded_lecture_watch_segments"
  ADD CONSTRAINT "field_training_recorded_lecture_watch_segments_progress_id_fkey"
  FOREIGN KEY ("progress_id") REFERENCES "field_training_recorded_lecture_progress"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE UNIQUE INDEX "uq_ft_rl_progress_lecture_application"
  ON "field_training_recorded_lecture_progress"("lecture_id", "application_id");

CREATE INDEX "idx_ft_rl_progress_lecture"
  ON "field_training_recorded_lecture_progress"("lecture_id");

CREATE INDEX "idx_ft_rl_progress_application"
  ON "field_training_recorded_lecture_progress"("application_id");

CREATE INDEX "idx_ft_rl_progress_student"
  ON "field_training_recorded_lecture_progress"("student_id");

CREATE INDEX "idx_ft_rl_progress_last_watched"
  ON "field_training_recorded_lecture_progress"("last_watched_at");

CREATE INDEX "idx_ft_rl_watch_segments_progress"
  ON "field_training_recorded_lecture_watch_segments"("progress_id");
