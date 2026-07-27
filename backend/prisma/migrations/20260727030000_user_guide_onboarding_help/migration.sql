-- Field training student guide / onboarding / help / support tickets

CREATE TYPE "user_onboarding_status" AS ENUM ('not_started', 'in_progress', 'completed', 'dismissed');
CREATE TYPE "support_ticket_status" AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE "support_ticket_category" AS ENUM (
  'ACCOUNT', 'EMAIL_VERIFICATION', 'PROFILE', 'OPPORTUNITY', 'APPLICATION',
  'SESSION', 'ATTENDANCE', 'ZOOM_LINK', 'PRE_TEST', 'POST_TEST', 'TASK',
  'SUBMISSION', 'AI_EVALUATION', 'PROGRESS', 'TRAINING_HOURS', 'CERTIFICATE',
  'TECHNICAL', 'OTHER'
);

CREATE TABLE IF NOT EXISTS "user_onboarding_progress" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "guide_key" VARCHAR(100) NOT NULL,
  "guide_version" VARCHAR(100) NOT NULL,
  "status" "user_onboarding_status" NOT NULL DEFAULT 'not_started',
  "last_step" INTEGER NOT NULL DEFAULT 0,
  "started_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "dismissed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_onboarding_progress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_user_onboarding_progress_user_guide_version"
  ON "user_onboarding_progress"("user_id", "guide_key", "guide_version");
CREATE INDEX IF NOT EXISTS "idx_user_onboarding_progress_user" ON "user_onboarding_progress"("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_onboarding_progress_guide_key" ON "user_onboarding_progress"("guide_key");
CREATE INDEX IF NOT EXISTS "idx_user_onboarding_progress_guide_version" ON "user_onboarding_progress"("guide_version");
CREATE INDEX IF NOT EXISTS "idx_user_onboarding_progress_status" ON "user_onboarding_progress"("status");

CREATE TABLE IF NOT EXISTS "help_categories" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "title_ar" VARCHAR(255) NOT NULL,
  "title_en" VARCHAR(255),
  "slug" VARCHAR(120) NOT NULL,
  "description_ar" TEXT,
  "description_en" TEXT,
  "icon" VARCHAR(64),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "target_roles" TEXT[] NOT NULL DEFAULT ARRAY['student']::TEXT[],
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "help_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "help_categories_slug_key" ON "help_categories"("slug");
CREATE INDEX IF NOT EXISTS "idx_help_categories_active" ON "help_categories"("is_active");
CREATE INDEX IF NOT EXISTS "idx_help_categories_sort" ON "help_categories"("sort_order");

CREATE TABLE IF NOT EXISTS "help_articles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "category_id" UUID NOT NULL,
  "title_ar" VARCHAR(500) NOT NULL,
  "title_en" VARCHAR(500),
  "slug" VARCHAR(200) NOT NULL,
  "summary_ar" TEXT,
  "summary_en" TEXT,
  "content_ar" TEXT NOT NULL,
  "content_en" TEXT,
  "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_published" BOOLEAN NOT NULL DEFAULT true,
  "target_roles" TEXT[] NOT NULL DEFAULT ARRAY['student']::TEXT[],
  "related_route" VARCHAR(255),
  "contextual_key" VARCHAR(100),
  "guide_version" VARCHAR(100),
  "is_faq" BOOLEAN NOT NULL DEFAULT false,
  "view_count" INTEGER NOT NULL DEFAULT 0,
  "created_by_id" UUID,
  "updated_by_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "help_articles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "help_articles_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "help_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS "help_articles_slug_key" ON "help_articles"("slug");
CREATE INDEX IF NOT EXISTS "idx_help_articles_category" ON "help_articles"("category_id");
CREATE INDEX IF NOT EXISTS "idx_help_articles_published" ON "help_articles"("is_published");
CREATE INDEX IF NOT EXISTS "idx_help_articles_sort" ON "help_articles"("sort_order");
CREATE INDEX IF NOT EXISTS "idx_help_articles_contextual_key" ON "help_articles"("contextual_key");
CREATE INDEX IF NOT EXISTS "idx_help_articles_guide_version" ON "help_articles"("guide_version");
CREATE INDEX IF NOT EXISTS "idx_help_articles_created" ON "help_articles"("created_at");

CREATE TABLE IF NOT EXISTS "help_article_views" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "article_id" UUID NOT NULL,
  "user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "help_article_views_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "help_article_views_article_id_fkey"
    FOREIGN KEY ("article_id") REFERENCES "help_articles"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_help_article_views_article" ON "help_article_views"("article_id");
CREATE INDEX IF NOT EXISTS "idx_help_article_views_user" ON "help_article_views"("user_id");
CREATE INDEX IF NOT EXISTS "idx_help_article_views_created" ON "help_article_views"("created_at");

CREATE TABLE IF NOT EXISTS "help_search_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "query" VARCHAR(500) NOT NULL,
  "results_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "help_search_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_help_search_logs_user" ON "help_search_logs"("user_id");
CREATE INDEX IF NOT EXISTS "idx_help_search_logs_created" ON "help_search_logs"("created_at");
CREATE INDEX IF NOT EXISTS "idx_help_search_logs_query" ON "help_search_logs"("query");

CREATE TABLE IF NOT EXISTS "support_tickets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "reference_code" VARCHAR(32) NOT NULL,
  "user_id" UUID NOT NULL,
  "category" "support_ticket_category" NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT NOT NULL,
  "status" "support_ticket_status" NOT NULL DEFAULT 'open',
  "opportunity_id" UUID,
  "session_id" UUID,
  "task_id" UUID,
  "assessment_id" UUID,
  "browser_info" VARCHAR(500),
  "device_info" VARCHAR(500),
  "attachment_file_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "support_tickets_reference_code_key" ON "support_tickets"("reference_code");
CREATE INDEX IF NOT EXISTS "idx_support_tickets_user" ON "support_tickets"("user_id");
CREATE INDEX IF NOT EXISTS "idx_support_tickets_status" ON "support_tickets"("status");
CREATE INDEX IF NOT EXISTS "idx_support_tickets_category" ON "support_tickets"("category");
CREATE INDEX IF NOT EXISTS "idx_support_tickets_created" ON "support_tickets"("created_at");
CREATE INDEX IF NOT EXISTS "idx_support_tickets_opportunity" ON "support_tickets"("opportunity_id");
