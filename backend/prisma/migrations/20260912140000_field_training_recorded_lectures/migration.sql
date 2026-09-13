-- Additive Field Training recorded lectures core architecture.
-- Does not alter scoring, attendance, assessments, applications, or historical results.

CREATE TYPE "field_training_recorded_lecture_provider" AS ENUM ('youtube', 'vimeo');
CREATE TYPE "field_training_recorded_lecture_source_type" AS ENUM ('single', 'playlist');
CREATE TYPE "field_training_recorded_lecture_status" AS ENUM ('draft', 'published', 'hidden');

CREATE TABLE "field_training_recorded_lectures" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "opportunity_id" UUID NOT NULL,
  "session_id" UUID,
  "provider" "field_training_recorded_lecture_provider" NOT NULL,
  "provider_video_id" VARCHAR(128) NOT NULL,
  "source_type" "field_training_recorded_lecture_source_type" NOT NULL DEFAULT 'single',
  "source_playlist_id" VARCHAR(128),
  "source_playlist_url" VARCHAR(2000),
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "thumbnail_url" VARCHAR(1000),
  "duration_seconds" INTEGER,
  "lecture_date" DATE,
  "instructor_name" VARCHAR(255),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "status" "field_training_recorded_lecture_status" NOT NULL DEFAULT 'draft',
  "published_at" TIMESTAMPTZ(6),
  "created_by_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "field_training_recorded_lectures_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "field_training_recorded_lectures"
  ADD CONSTRAINT "field_training_recorded_lectures_opportunity_id_fkey"
  FOREIGN KEY ("opportunity_id") REFERENCES "field_training_opportunities"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "field_training_recorded_lectures"
  ADD CONSTRAINT "field_training_recorded_lectures_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "field_training_sessions"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE UNIQUE INDEX "uq_ft_recorded_lectures_opp_provider_video"
  ON "field_training_recorded_lectures"("opportunity_id", "provider", "provider_video_id");

CREATE INDEX "idx_ft_recorded_lectures_opp_status_sort"
  ON "field_training_recorded_lectures"("opportunity_id", "status", "sort_order");

CREATE INDEX "idx_ft_recorded_lectures_session"
  ON "field_training_recorded_lectures"("session_id");
