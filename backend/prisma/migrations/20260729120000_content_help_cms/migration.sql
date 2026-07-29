-- Content Help CMS: extend help tables + tours/popups/announcements (idempotent)

DO $$ BEGIN CREATE TYPE "content_publish_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "managed_popup_type" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'IMPORTANT', 'URGENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "managed_popup_display_rule" AS ENUM ('ONCE', 'ONCE_PER_VERSION', 'EVERY_LOGIN', 'UNTIL_ACKNOWLEDGED', 'DATE_RANGE', 'EVENT_TRIGGERED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "announcement_type" AS ENUM ('INFORMATION', 'SUCCESS', 'WARNING', 'IMPORTANT', 'URGENT', 'MAINTENANCE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "announcement_status" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'PAUSED', 'EXPIRED', 'ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "announcement_channel_type" AS ENUM ('TOP_BANNER', 'DASHBOARD_CARD', 'POPUP', 'NOTIFICATION_CENTER', 'IN_APP_NOTIFICATION', 'CONTEXTUAL_BLOCK', 'EMAIL', 'PUSH_NOTIFICATION', 'SMS'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "announcement_target_type" AS ENUM ('ROLE', 'UNIVERSITY', 'SPECIALTY', 'OPPORTUNITY', 'SESSION', 'USER', 'ACCOUNT_STATUS', 'APPLICATION_STATUS', 'ALL_USERS'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "help_categories"
  ADD COLUMN IF NOT EXISTS "status" "content_publish_status" NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN IF NOT EXISTS "target_university_ids" UUID[] DEFAULT ARRAY[]::UUID[],
  ADD COLUMN IF NOT EXISTS "created_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "updated_by_id" UUID;

UPDATE "help_categories" SET "status" = CASE WHEN "is_active" THEN 'PUBLISHED'::"content_publish_status" ELSE 'ARCHIVED'::"content_publish_status" END
WHERE "status" IS NULL OR true;

CREATE INDEX IF NOT EXISTS "idx_help_categories_status" ON "help_categories"("status");

ALTER TABLE "help_articles"
  ADD COLUMN IF NOT EXISTS "status" "content_publish_status" NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN IF NOT EXISTS "content_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "target_university_id" UUID,
  ADD COLUMN IF NOT EXISTS "target_opportunity_id" UUID,
  ADD COLUMN IF NOT EXISTS "show_in_contextual" BOOLEAN NOT NULL DEFAULT false;

UPDATE "help_articles" SET
  "status" = CASE WHEN "is_published" THEN 'PUBLISHED'::"content_publish_status" ELSE 'DRAFT'::"content_publish_status" END,
  "published_at" = CASE WHEN "is_published" THEN COALESCE("published_at", "created_at") ELSE "published_at" END,
  "show_in_contextual" = CASE WHEN "contextual_key" IS NOT NULL OR "related_route" IS NOT NULL THEN true ELSE "show_in_contextual" END;

CREATE INDEX IF NOT EXISTS "idx_help_articles_status" ON "help_articles"("status");
CREATE INDEX IF NOT EXISTS "idx_help_articles_university" ON "help_articles"("target_university_id");

CREATE TABLE IF NOT EXISTS "help_article_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "article_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "title_ar" VARCHAR(500) NOT NULL,
  "title_en" VARCHAR(500),
  "summary_ar" TEXT,
  "summary_en" TEXT,
  "content_ar" TEXT NOT NULL,
  "content_en" TEXT,
  "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "created_by_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "change_note" VARCHAR(500),
  CONSTRAINT "help_article_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_help_article_versions_article_version" ON "help_article_versions"("article_id", "version");
CREATE INDEX IF NOT EXISTS "idx_help_article_versions_article" ON "help_article_versions"("article_id");
CREATE INDEX IF NOT EXISTS "idx_help_article_versions_created" ON "help_article_versions"("created_at");

DO $$ BEGIN
  ALTER TABLE "help_article_versions" ADD CONSTRAINT "help_article_versions_article_id_fkey"
    FOREIGN KEY ("article_id") REFERENCES "help_articles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "user_guides" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name_ar" VARCHAR(255) NOT NULL,
  "name_en" VARCHAR(255),
  "guide_key" VARCHAR(100) NOT NULL,
  "guide_version" VARCHAR(100) NOT NULL,
  "target_role" VARCHAR(50) NOT NULL,
  "status" "content_publish_status" NOT NULL DEFAULT 'DRAFT',
  "auto_show" BOOLEAN NOT NULL DEFAULT true,
  "skippable" BOOLEAN NOT NULL DEFAULT true,
  "reshow_on_new_version" BOOLEAN NOT NULL DEFAULT false,
  "starts_at" TIMESTAMPTZ(6),
  "ends_at" TIMESTAMPTZ(6),
  "show_conditions" JSONB,
  "created_by_id" UUID,
  "updated_by_id" UUID,
  "published_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_guides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_user_guides_key_version" ON "user_guides"("guide_key", "guide_version");
CREATE INDEX IF NOT EXISTS "idx_user_guides_target_role" ON "user_guides"("target_role");
CREATE INDEX IF NOT EXISTS "idx_user_guides_status" ON "user_guides"("status");

CREATE TABLE IF NOT EXISTS "user_guide_steps" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "guide_id" UUID NOT NULL,
  "title_ar" VARCHAR(255) NOT NULL,
  "title_en" VARCHAR(255),
  "body_ar" TEXT NOT NULL,
  "body_en" TEXT,
  "icon" VARCHAR(64),
  "tour_target" VARCHAR(100),
  "related_route" VARCHAR(255),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_required" BOOLEAN NOT NULL DEFAULT false,
  "skippable" BOOLEAN NOT NULL DEFAULT true,
  "status" "content_publish_status" NOT NULL DEFAULT 'PUBLISHED',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_guide_steps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_user_guide_steps_guide" ON "user_guide_steps"("guide_id");
CREATE INDEX IF NOT EXISTS "idx_user_guide_steps_sort" ON "user_guide_steps"("sort_order");

DO $$ BEGIN
  ALTER TABLE "user_guide_steps" ADD CONSTRAINT "user_guide_steps_guide_id_fkey"
    FOREIGN KEY ("guide_id") REFERENCES "user_guides"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "managed_popups" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "admin_name" VARCHAR(255) NOT NULL,
  "title_ar" VARCHAR(500) NOT NULL,
  "title_en" VARCHAR(500),
  "body_ar" TEXT NOT NULL,
  "body_en" TEXT,
  "icon" VARCHAR(64),
  "image_url" VARCHAR(1000),
  "popup_type" "managed_popup_type" NOT NULL DEFAULT 'INFO',
  "cta_label_ar" VARCHAR(120),
  "cta_label_en" VARCHAR(120),
  "cta_url" VARCHAR(1000),
  "is_dismissible" BOOLEAN NOT NULL DEFAULT true,
  "requires_acknowledgement" BOOLEAN NOT NULL DEFAULT false,
  "display_rule" "managed_popup_display_rule" NOT NULL DEFAULT 'ONCE',
  "target_roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "target_university_ids" UUID[] DEFAULT ARRAY[]::UUID[],
  "target_specialty_ids" UUID[] DEFAULT ARRAY[]::UUID[],
  "target_opportunity_ids" UUID[] DEFAULT ARRAY[]::UUID[],
  "target_session_ids" UUID[] DEFAULT ARRAY[]::UUID[],
  "target_user_ids" UUID[] DEFAULT ARRAY[]::UUID[],
  "page_routes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "starts_at" TIMESTAMPTZ(6),
  "ends_at" TIMESTAMPTZ(6),
  "priority" INTEGER NOT NULL DEFAULT 100,
  "max_displays" INTEGER,
  "status" "content_publish_status" NOT NULL DEFAULT 'DRAFT',
  "content_version" INTEGER NOT NULL DEFAULT 1,
  "system_key" VARCHAR(100),
  "trigger_event" VARCHAR(100),
  "created_by_id" UUID,
  "updated_by_id" UUID,
  "published_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "managed_popups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "managed_popups_system_key_key" ON "managed_popups"("system_key");
CREATE INDEX IF NOT EXISTS "idx_managed_popups_status" ON "managed_popups"("status");
CREATE INDEX IF NOT EXISTS "idx_managed_popups_priority" ON "managed_popups"("priority");
CREATE INDEX IF NOT EXISTS "idx_managed_popups_schedule" ON "managed_popups"("starts_at", "ends_at");

CREATE TABLE IF NOT EXISTS "managed_popup_user_states" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "popup_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "popup_version" INTEGER NOT NULL DEFAULT 1,
  "first_seen_at" TIMESTAMPTZ(6),
  "last_seen_at" TIMESTAMPTZ(6),
  "dismissed_at" TIMESTAMPTZ(6),
  "acknowledged_at" TIMESTAMPTZ(6),
  "clicked_at" TIMESTAMPTZ(6),
  "view_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "managed_popup_user_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_managed_popup_user_states" ON "managed_popup_user_states"("popup_id", "user_id");
CREATE INDEX IF NOT EXISTS "idx_managed_popup_user_states_user" ON "managed_popup_user_states"("user_id");

DO $$ BEGIN
  ALTER TABLE "managed_popup_user_states" ADD CONSTRAINT "managed_popup_user_states_popup_id_fkey"
    FOREIGN KEY ("popup_id") REFERENCES "managed_popups"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "announcements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "admin_name" VARCHAR(255) NOT NULL,
  "title_ar" VARCHAR(500) NOT NULL,
  "title_en" VARCHAR(500),
  "summary_ar" TEXT,
  "summary_en" TEXT,
  "content_ar" TEXT NOT NULL,
  "content_en" TEXT,
  "icon" VARCHAR(64),
  "image_url" VARCHAR(1000),
  "announcement_type" "announcement_type" NOT NULL DEFAULT 'INFORMATION',
  "priority" INTEGER NOT NULL DEFAULT 100,
  "status" "announcement_status" NOT NULL DEFAULT 'DRAFT',
  "starts_at" TIMESTAMPTZ(6),
  "ends_at" TIMESTAMPTZ(6),
  "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Amman',
  "is_dismissible" BOOLEAN NOT NULL DEFAULT true,
  "requires_acknowledgement" BOOLEAN NOT NULL DEFAULT false,
  "is_pinned" BOOLEAN NOT NULL DEFAULT false,
  "is_blocking" BOOLEAN NOT NULL DEFAULT false,
  "max_displays" INTEGER,
  "cta_label_ar" VARCHAR(120),
  "cta_label_en" VARCHAR(120),
  "cta_url" VARCHAR(1000),
  "trigger_event" VARCHAR(100),
  "content_version" INTEGER NOT NULL DEFAULT 1,
  "created_by_id" UUID,
  "updated_by_id" UUID,
  "published_by_id" UUID,
  "published_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_announcements_status" ON "announcements"("status");
CREATE INDEX IF NOT EXISTS "idx_announcements_priority" ON "announcements"("priority");
CREATE INDEX IF NOT EXISTS "idx_announcements_schedule" ON "announcements"("starts_at", "ends_at");
CREATE INDEX IF NOT EXISTS "idx_announcements_created_by" ON "announcements"("created_by_id");

CREATE TABLE IF NOT EXISTS "announcement_targets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "announcement_id" UUID NOT NULL,
  "target_type" "announcement_target_type" NOT NULL,
  "role_code" VARCHAR(50),
  "university_id" UUID,
  "specialty_id" UUID,
  "opportunity_id" UUID,
  "session_id" UUID,
  "user_id" UUID,
  "account_status" VARCHAR(50),
  "application_status" VARCHAR(50),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "announcement_targets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_announcement_targets_announcement" ON "announcement_targets"("announcement_id");
CREATE INDEX IF NOT EXISTS "idx_announcement_targets_type" ON "announcement_targets"("target_type");
CREATE INDEX IF NOT EXISTS "idx_announcement_targets_university" ON "announcement_targets"("university_id");
CREATE INDEX IF NOT EXISTS "idx_announcement_targets_role" ON "announcement_targets"("role_code");

DO $$ BEGIN
  ALTER TABLE "announcement_targets" ADD CONSTRAINT "announcement_targets_announcement_id_fkey"
    FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "announcement_channels" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "announcement_id" UUID NOT NULL,
  "channel_type" "announcement_channel_type" NOT NULL,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "announcement_channels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_announcement_channels" ON "announcement_channels"("announcement_id", "channel_type");
CREATE INDEX IF NOT EXISTS "idx_announcement_channels_type" ON "announcement_channels"("channel_type");

DO $$ BEGIN
  ALTER TABLE "announcement_channels" ADD CONSTRAINT "announcement_channels_announcement_id_fkey"
    FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "announcement_user_states" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "announcement_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "announcement_version" INTEGER NOT NULL DEFAULT 1,
  "first_seen_at" TIMESTAMPTZ(6),
  "last_seen_at" TIMESTAMPTZ(6),
  "dismissed_at" TIMESTAMPTZ(6),
  "acknowledged_at" TIMESTAMPTZ(6),
  "clicked_at" TIMESTAMPTZ(6),
  "view_count" INTEGER NOT NULL DEFAULT 0,
  "channel_seen" VARCHAR(50),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "announcement_user_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_announcement_user_states" ON "announcement_user_states"("announcement_id", "user_id");
CREATE INDEX IF NOT EXISTS "idx_announcement_user_states_user" ON "announcement_user_states"("user_id");

DO $$ BEGIN
  ALTER TABLE "announcement_user_states" ADD CONSTRAINT "announcement_user_states_announcement_id_fkey"
    FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
